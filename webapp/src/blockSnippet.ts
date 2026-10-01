import * as Blockly from "blockly";
import * as pxtblockly from "../../pxtblocks";
import * as core from "./core";
import * as pkg from "./package";
import { validateBackpackRequirements } from "./backpack";
import { BackpackUserError } from "./backpackErrors";

export interface BlockSnippetRequirements {
    dependencies: pxt.Map<string>;
    projectBlocks?: pxt.Map<string>;
}

export interface BlockSnippetProjectHost {
    headerId: string;
    /** False if the project or user changed, or the editor is no longer ready. */
    isCurrent: () => boolean;
    getBlocksInfo: () => pxtc.BlocksInfo;
    /** Save current blocks and TypeScript, including any newly generated asset files. */
    saveAsync: () => Promise<void>;
    /** Wait for both reloadHeaderAsync and the blocks editor's loadingXmlPromise. */
    reloadAsync: () => Promise<void>;
}

const own = (value: object, key: string): boolean => !!value && Object.prototype.hasOwnProperty.call(value, key);
const safeKey = (key: string): boolean => !["__proto__", "constructor", "prototype"].includes(key);
const maxBlocks = 500;
const maxDepth = 100;

function invalidSnippet(): never {
    throw new Error("The copied blocks contain invalid or unsupported snippet data.");
}

function isRecord(value: unknown): value is pxt.Map<unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === null || Object.getPrototypeOf(proto) === null;
}

function isName(value: unknown): value is string {
    return typeof value === "string" && !!value.length && value.length <= 256 && safeKey(value)
        && !Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

/** Reject oversized or deeply nested field, mutation, and asset data before traversing it. */
function checkData(value: unknown): void {
    const seen = new Set<object>();
    let count = 0;
    let length = 0;
    const visit = (value: unknown, depth: number): void => {
        if (++count > 100000 || depth > 3 * maxDepth || length > 1000000) invalidSnippet();
        if (typeof value === "string") length += value.length;
        else if (value && typeof value === "object") {
            if (seen.has(value) || (!Array.isArray(value) && !isRecord(value))) invalidSnippet();
            seen.add(value);
            const keys = Object.keys(value);
            if (keys.length > 100000 - count) invalidSnippet();
            for (const key of keys) {
                length += key.length;
                // Serialized JSON cannot have accessors or prototype-setting keys.
                const property = Object.getOwnPropertyDescriptor(value, key);
                if (!safeKey(key) || !property || !own(property, "value")) invalidSnippet();
                visit(property.value, depth + 1);
            }
            seen.delete(value);
        } else if (typeof value === "number" ? !Number.isFinite(value)
            : value !== null && value !== undefined && typeof value !== "boolean")
            invalidSnippet();
        if (length > 1000000) invalidSnippet();
    };

    visit(value, 0);
}

function snippetStates(states: Blockly.serialization.blocks.State[]): Blockly.serialization.blocks.State[] {
    const result: Blockly.serialization.blocks.State[] = [];
    pxtblockly.visitBlockStates(states, state => result.push(state));
    return result;
}

/** Include connected blocks and shadows hidden by another block. */
export function getBlockSnippetTypes(states: Blockly.serialization.blocks.State[]): string[] {
    return Array.from(new Set(snippetStates(states).map(state => state.type)));
}

/** Compare installed package references without downloading or changing extensions. */
export function getMissingBlockSnippetDependencies(
    dependencies: pxt.Map<string>,
    project: pxt.MainPackage
): [string, string][] {
    return Object.entries(dependencies || {}).filter(([name, version]) => {
        const dependency = Object.prototype.hasOwnProperty.call(project.deps, name) ? project.deps[name] : undefined;
        const installed = dependency && (version === "*" || dependency.verProtocol() === "github"
            && version.startsWith("github:") && dependency.version().split("#")[0].toLowerCase() === version.split("#")[0].toLowerCase()
            || dependency.version() === version);
        return !installed;
    });
}

// Local references can match an installed package, but getConfigAsync cannot fetch them.
function localReference(version: string): boolean {
    return /^(?:workspace|pkg):[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(version)
        || /^file:[A-Za-z0-9_./\\: -]+$/.test(version) && version.trim() === version;
}

/** Accept local clipboard references as well as dependencies allowed in Backpack saves. */
function validateRequirements(value: unknown): BlockSnippetRequirements {
    checkData(value);
    if (!isRecord(value) || !own(value, "dependencies") || !isRecord(value.dependencies)
        || Object.keys(value.dependencies).length > 100
        || Object.keys(value).some(key => key !== "dependencies" && key !== "projectBlocks"))
        invalidSnippet();

    const portable: pxt.Map<string> = Object.create(null);
    const local: pxt.Map<string> = Object.create(null);
    for (const name of Object.keys(value.dependencies)) {
        const version = value.dependencies[name];
        if (typeof version !== "string" || version.length > 256) invalidSnippet();
        if (localReference(version)) {
            local[name] = version;
            portable[name] = "pub:local"; // Check the package name without rejecting its local reference.
        } else portable[name] = version;
    }

    try {
        const saved = validateBackpackRequirements({ dependencies: portable, projectBlocks: value.projectBlocks });
        for (const name of Object.keys(local)) saved.dependencies[name] = local[name];
        return { dependencies: saved.dependencies, projectBlocks: saved.projectBlocks };
    } catch {
        throw new Error("The copied blocks have invalid extension or project-source requirements.");
    }
}

function sameSource(left: string, right: string): boolean {
    if (left.startsWith("github:") && right.startsWith("github:")) {
        return left.split("#")[0].toLowerCase() === right.split("#")[0].toLowerCase();
    }
    return left === right;
}

function dependencyReference(name: string, dependency: pxt.Package): string | undefined {
    const version = dependency?.version();
    // Package resolution rewrites bundled '*' (including default core packages)
    // to embed:<id>. Save "*" so the reference still works in another project.
    return version === `embed:${name}` && own(pxt.appTarget.bundledpkgs, name) ? "*" : version;
}

/** Collect packages and project source used by the copied blocks. */
export function getBlockSnippetRequirements(
    states: Blockly.serialization.blocks.State[],
    info: pxtc.BlocksInfo,
    main: pxt.MainPackage
): BlockSnippetRequirements {
    const blocks = snippetStates(states);
    const dependencies: pxt.Map<string> = Object.create(null);
    const projectBlocks: pxt.Map<string> = Object.create(null);

    const collect = (symbol: pxtc.SymbolInfo, blockType?: string): void => {
        if (!symbol) return; // Blockly builtins have no API symbol.
        const local = !symbol.pkg || symbol.pkg === main.id || symbol.pkg === "main"
            || (symbol.fileName && !/^pxt_modules\//.test(symbol.fileName));
        if (local) {
            if (blockType) projectBlocks[blockType] = symbol.fileName;
            return; // Local asset data is included by full field serialization.
        }

        const dependency = own(main.deps, symbol.pkg) ? main.deps[symbol.pkg] : undefined;
        const version = dependencyReference(symbol.pkg, dependency);
        try {
            if (!version || dependency.cppOnly) throw new Error();
            validateRequirements({ dependencies: { [symbol.pkg]: version } });
        } catch {
            throw new BackpackUserError(lf("The extension '{0}' cannot be copied. Publish it and install the published extension before copying these blocks.", symbol.pkg));
        }
        dependencies[symbol.pkg] = version;
    };
    for (const state of blocks)
        collect(own(info.blocksById, state.type) ? info.blocksById[state.type] : undefined, state.type);

    const references = (value: unknown, allowUnqualified = false): void => {
        if (typeof value === "string") {
            if ((allowUnqualified || /^[\w$]+(?:\.[\w$]+)+$/.test(value)) && own(info.apis.byQName, value))
                collect(info.apis.byQName[value]);
        } else if (value && typeof value === "object") {
            for (const key of Object.keys(value)) references((value as pxt.Map<unknown>)[key]);
        }
    };

    for (const state of blocks) {
        const symbol = own(info.blocksById, state.type) ? info.blocksById[state.type] : undefined;
        const parameters = symbol && pxt.blocks.compileInfo(symbol).definitionNameToParam;
        for (const name of Object.keys(state.fields || {})) {
            const parameter = parameters && own(parameters, name) ? parameters[name] : undefined;
            // A text input saying "extension.member" is not an API reference.
            if (parameter?.type === "string" && !parameter.fieldEditor) continue;
            if (["text", "text_join", "variables_get", "variables_set", "variables_change"].includes(state.type)) continue;
            references(state.fields[name], !!parameter && parameter.type !== "string");
        }
        references(state.extraState);
        if (/^function_(definition|call|call_output)$/.test(state.type)) {
            const extra: unknown = state.extraState;
            if (isRecord(extra) && extra.arguments !== undefined) {
                if (!Array.isArray(extra.arguments)) invalidSnippet();
                for (const arg of extra.arguments) {
                    if (!isRecord(arg) || typeof arg.type !== "string") invalidSnippet();
                    references(arg.type.replace(/\[\]$/, ""), true);
                }
            }
        }
    }

    return validateRequirements({ dependencies, projectBlocks });
}

interface RequiredPackage {
    name: string;
    version: string;
    config: pxt.PackageConfig;
}

/** Install missing dependencies without replacing installed extensions or inserting blocks. */
export async function ensureBlockSnippetAsync(
    requirements: BlockSnippetRequirements | undefined,
    types: string[],
    host: BlockSnippetProjectHost
): Promise<boolean> {
    const saved = validateRequirements(requirements === undefined ? { dependencies: {} } : requirements);
    checkData(types);
    if (!Array.isArray(types) || types.length > maxBlocks) invalidSnippet();
    for (const type of types)
        if (!isName(type)) invalidSnippet();
    types = types.slice();

    const assertCurrent = (): void => {
        if (!host.isCurrent() || !host.headerId || pkg.mainEditorPkg().header?.id !== host.headerId) {
            throw new BackpackUserError(lf("Your project or account changed. Please retry the operation."));
        }
    };
    const wait = async <T>(action: () => Promise<T>): Promise<T> => {
        assertCurrent();
        try {
            return await action();
        } finally {
            assertCurrent();
        }
    };
    const explain = (header: string, body: string): Promise<number> => wait(() => core.confirmAsync({
        header,
        body,
        hideCancel: true,
        agreeLbl: lf("OK")
    }));
    const missingProjectCode = async (): Promise<boolean> => {
        assertCurrent();
        const info = host.getBlocksInfo();
        const files = Array.from(new Set(Object.keys(saved.projectBlocks || {})
            .filter(type => !own(info.blocksById, type))
            .map(type => saved.projectBlocks[type])));
        if (!files.length) return false;
        await explain(lf("Project code is required"), lf("This snippet uses blocks defined in {0} in its original project. Those source files are not in this project. Copy the required code into this project or publish it as an extension before adding this snippet.", files.join(", ")));
        assertCurrent();
        return true;
    };

    assertCurrent();
    if (await wait(missingProjectCode)) return false;
    const main = pkg.mainPkg;
    const editor = pkg.mainEditorPkg();
    const configFile = editor.files[pxt.CONFIG_NAME];
    if (!configFile) throw new Error("The project configuration is missing.");
    const readConfig = (): pxt.PackageConfig => {
        const config = pxt.Package.parseAndValidConfig(configFile.content);
        if (!config) throw new Error("The project configuration is invalid.");
        return config;
    };
    const originalDependencies = readConfig().dependencies;

    const assertUnchanged = (): void => {
        assertCurrent();
        const currentDependencies = readConfig().dependencies;
        if (pkg.mainPkg !== main || pkg.mainEditorPkg() !== editor || editor.files[pxt.CONFIG_NAME] !== configFile
            || Object.keys(currentDependencies).length !== Object.keys(originalDependencies).length
            || Object.keys(originalDependencies).some(name => currentDependencies[name] !== originalDependencies[name])) {
            throw new BackpackUserError(lf("The project extensions changed. Please retry the operation."));
        }
    };

    const missing: string[] = [];
    for (const name of Object.keys(saved.dependencies)) {
        const dependency = own(main.deps, name) ? main.deps[name] : undefined;
        if (!dependency) missing.push(name);
        else if (dependency.cppOnly || dependency.config?.name !== name
            || !sameSource(dependencyReference(name, dependency), saved.dependencies[name])) {
            await explain(lf("Extension conflict"), lf("This snippet requires {0} ({1}), but this project has a different source for that extension. Resolve the conflict before adding the snippet.", name, saved.dependencies[name]));
            return false;
        }
    }

    const explainLocal = async (name: string): Promise<boolean> => {
        await explain(lf("Publish the required extension"), lf("The extension '{0}' is local to the original project and cannot be installed from the copied blocks. Publish it and install the published extension before retrying the operation.", name));
        return false;
    };
    const missingLocal = missing.find(name => localReference(saved.dependencies[name]));
    if (missingLocal) return explainLocal(missingLocal);

    if (missing.length) {
        const approved = await wait(() => core.confirmAsync({
            header: lf("Add required extensions?"),
            body: lf("This snippet requires the following extensions:\n{0}", missing.map(name => `${name}: ${saved.dependencies[name]}`).join("\n")),
            agreeLbl: lf("Add extensions and snippet")
        }));
        if (!approved) return false;
        assertUnchanged();

        // Check all required packages before changing the project. findConflictsAsync
        // does not reject missing transitive configs or stop dependency cycles.
        const planned = new Map<string, RequiredPackage>();
        const pending = missing.map(name => ({ name, version: saved.dependencies[name] }));
        while (pending.length) {
            assertUnchanged();
            const { name, version } = pending.shift();
            validateRequirements({ dependencies: { [name]: version } });
            const installed = own(main.deps, name) ? main.deps[name] : undefined;
            const previous = planned.get(name);
            if (installed || previous) {
                if (installed && (installed.cppOnly || installed.config?.name !== name)
                    || !sameSource(installed ? dependencyReference(name, installed) : previous.version, version)) {
                    await explain(lf("Extension conflict"), lf("The required extensions use different sources for '{0}'. No extensions were changed.", name));
                    return false;
                }
                continue;
            }
            if (localReference(version)) return explainLocal(name);
            if (planned.size >= 100) throw new BackpackUserError(lf("This snippet requires too many extensions."));
            if ((version.startsWith("github:") && (pxt.appTarget.cloud?.packages === false || pxt.appTarget.cloud?.githubPackages === false))
                || (version.startsWith("pub:") && pxt.appTarget.cloud?.packages === false)) {
                await explain(lf("Extensions are unavailable"), lf("This editor does not allow the extension '{0}'.", name));
                return false;
            }
            const config = await wait(() => pxt.Package.getConfigAsync(main.targetVersion(), name, version));
            assertUnchanged();
            if (!config) {
                await explain(lf("Extension unavailable"), lf("The extension '{0}' is unavailable or is not allowed in this editor.", name));
                return false;
            }
            if (!pxt.Package.parseAndValidConfig(JSON.stringify(config)) || config.name !== name) {
                throw new Error(`The extension '${name}' returned an invalid or mismatched configuration.`);
            }
            // Validate the complete dependency map before scheduling any further downloads.
            validateRequirements({ dependencies: config.dependencies });
            // This flag governs editor extensions, not ordinary block APIs on GitHub.
            if (config.extension && !pxt.appTarget.appTheme?.allowPackageExtensions) {
                await explain(lf("Extensions are unavailable"), lf("This editor does not allow the editor extension '{0}'.", name));
                return false;
            }
            planned.set(name, { name, version, config });
            pending.push(...Object.keys(config.dependencies).map(name => ({ name, version: config.dependencies[name] })));
        }

        // Check conflicts without changing the project or replacing installed packages.
        // Dependencies were checked above; empty maps avoid fetching them again here.
        const prospective: pxt.MainPackage = Object.create(main);
        prospective.parent = prospective;
        const dependencies = main.sortedDeps().slice();
        prospective.sortedDeps = () => dependencies;
        for (const required of planned.values()) {
            const conflicts = await wait(() => prospective.findConflictsAsync(
                { ...required.config, dependencies: {} },
                required.version
            ));
            assertUnchanged();
            if (conflicts.length) {
                await explain(lf("Extension conflict"), lf("Adding '{0}' would replace or conflict with another extension. Resolve the conflict before adding this snippet. No extensions were changed.", required.name));
                return false;
            }
            const dependency = new pxt.Package(required.name, required.version, prospective, prospective, required.name);
            dependency.config = required.config;
            dependencies.push(dependency);
        }

        await wait(host.saveAsync); // Save both blocks and TypeScript before reloading.
        assertUnchanged();
        // Saving blocks may legitimately add asset files to config. Merge into the latest
        // config, preserving those files and other user edits, but never a changed dependency set.
        const originalConfig = configFile.content;
        const config = readConfig();
        for (const name of missing) config.dependencies[name] = saved.dependencies[name];
        const updated = pxt.Package.stringifyConfig(config);
        let writeFailed = false;
        let writeError: unknown;

        try {
            // setContentAsync updates this EditorPackage before yielding, so the
            // project cannot change between assertUnchanged and the in-memory write.
            assertUnchanged();
            await wait(() => configFile.setContentAsync(updated));
        } catch (error) {
            writeFailed = true;
            writeError = error;
        }

        // A failed save may already have changed in-memory config. Never roll it back or
        // reload a different project/account. Preserve the original failure if reload fails.
        if (configFile.content !== originalConfig && host.isCurrent()
            && pkg.mainEditorPkg().header?.id === host.headerId) {
            try {
                await wait(host.reloadAsync);
            } catch (error) {
                if (!writeFailed) throw error;
            }
        }
        if (writeFailed) throw writeError;
        assertCurrent();
    }

    if (await wait(missingProjectCode)) return false;
    assertCurrent();
    for (const name of Object.keys(saved.dependencies)) {
        const dependency = own(pkg.mainPkg.deps, name) ? pkg.mainPkg.deps[name] : undefined;
        if (!dependency || dependency.cppOnly || dependency.config?.name !== name
            || !sameSource(dependencyReference(name, dependency), saved.dependencies[name])) {
            await explain(lf("Extension unavailable"), lf("The required extension '{0}' is not available in this project. The snippet was not added.", name));
            return false;
        }
    }

    const info = host.getBlocksInfo();
    const builtins = pxtblockly.builtinBlocks();
    if (types.some(type => !own(Blockly.Blocks, type) || (!own(builtins, type) && !own(info.blocksById, type)))) {
        await explain(lf("Blocks unavailable"), lf("This snippet uses blocks that are not available in this project. Check the required extension versions and project source before trying again."));
        return false;
    }
    assertCurrent();
    return true;
}