import * as Blockly from "blockly";
import * as pxtblockly from "../../pxtblocks";
import * as core from "./core";
import * as pkg from "./package";
import { validateBackpackItem } from "./backpack";

export interface BackpackProjectHost {
    headerId: string;
    /** Captures the project, user, and editor readiness; false once that context changes. */
    isCurrent: () => boolean;
    getWorkspace: () => Blockly.WorkspaceSvg;
    getBlocksInfo: () => pxtc.BlocksInfo;
    /** Save current blocks and TypeScript, including any newly generated asset files. */
    saveAsync: () => Promise<void>;
    /** Await reloadHeaderAsync AND the blocks editor's loadingXmlPromise. */
    reloadAsync: () => Promise<void>;
}

const own = (value: object, key: string): boolean => !!value && Object.prototype.hasOwnProperty.call(value, key);

// Reuse the store's portable-reference policy rather than maintaining a second schema.
function validateDependencies(dependencies: pxt.Map<string>): void {
    validateBackpackItem({
        id: "00000000-0000-4000-8000-000000000000", name: "Backpack", code: "", createdAt: 0, dependencies
    });
}

function sameSource(left: string, right: string): boolean {
    if (left.startsWith("github:") && right.startsWith("github:")) {
        return left.split("#")[0].toLowerCase() === right.split("#")[0].toLowerCase();
    }
    return left === right;
}

/** Capture only the packages and project source actually referenced by the saved blocks. */
export function getBackpackRequirements(code: string, info: pxtc.BlocksInfo, main: pxt.MainPackage): {
    dependencies: pxt.Map<string>; projectBlocks: pxt.Map<string>;
} {
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
        const dependency = main.deps[symbol.pkg];
        const version = dependency?.version();
        try {
            if (!version || dependency.cppOnly) throw new Error();
            validateDependencies({ [symbol.pkg]: version });
        } catch {
            throw new Error(lf("The extension '{0}' cannot be copied to another project. Publish it and install the published extension before saving this snippet to your Backpack.", symbol.pkg));
        }
        dependencies[symbol.pkg] = version;
    };
    for (const type of pxtblockly.getBackpackBlockTypes(code)) collect(info.blocksById[type], type);

    const references = (value: unknown, allowUnqualified = false): void => {
        if (typeof value === "string") {
            if (allowUnqualified || /^[\w$]+(?:\.[\w$]+)+$/.test(value)) collect(info.apis.byQName[value]);
        } else if (value && typeof value === "object") {
            for (const key of Object.keys(value)) references((value as pxt.Map<unknown>)[key]);
        }
    };
    const visit = (state: Blockly.serialization.blocks.State): void => {
        const symbol = info.blocksById[state.type];
        const parameters = symbol && pxt.blocks.compileInfo(symbol).definitionNameToParam;
        for (const name of Object.keys(state.fields || {})) {
            const parameter = parameters?.[name];
            // A text input saying "extension.member" is not an API reference.
            if (parameter?.type === "string" && !parameter.fieldEditor) continue;
            if (["text", "text_join", "variables_get", "variables_set", "variables_change"].includes(state.type)) continue;
            references(state.fields[name], !!parameter && parameter.type !== "string");
        }
        references(state.extraState);
        if (/^function_(definition|call|call_output)$/.test(state.type)) {
            const extra = state.extraState as { arguments?: { type: string }[] };
            for (const arg of extra?.arguments || []) references(arg.type.replace(/\[\]$/, ""), true);
        }
        for (const input of Object.values(state.inputs || {})) {
            if (input.shadow) visit(input.shadow);
            if (input.block) visit(input.block);
        }
        if (state.next?.shadow) visit(state.next.shadow);
        if (state.next?.block) visit(state.next.block);
    };
    pxtblockly.parseBackpackCode(code).blocks.forEach(visit);
    validateDependencies(dependencies);
    return { dependencies, projectBlocks };
}

interface RequiredPackage {
    name: string;
    version: string;
    config: pxt.PackageConfig;
}

/** Add without replacing extensions, losing unsaved code, or trusting stale Blockly definitions. */
export async function addBackpackToProjectAsync(item: pxt.auth.BackpackItem, host: BackpackProjectHost): Promise<boolean> {
    const saved = validateBackpackItem(item);
    const types = pxtblockly.getBackpackBlockTypes(saved.code); // Also validates the complete serialized payload.
    const assertCurrent = (): void => {
        if (!host.isCurrent() || !host.headerId || pkg.mainEditorPkg().header?.id !== host.headerId) {
            throw new Error(lf("Your project or account changed. Please reopen the Backpack."));
        }
    };
    const wait = async <T>(action: () => Promise<T>): Promise<T> => {
        assertCurrent();
        try { return await action(); }
        finally { assertCurrent(); }
    };
    const explain = (header: string, body: string): Promise<number> => wait(() => core.confirmAsync({
        header, body, hideCancel: true, agreeLbl: lf("OK")
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
    if (!configFile) throw new Error(lf("The project configuration is missing."));
    const readConfig = (): pxt.PackageConfig => {
        const config = pxt.Package.parseAndValidConfig(configFile.content);
        if (!config) throw new Error(lf("The project configuration is invalid."));
        return config;
    };
    const originalDependencies = readConfig().dependencies;
    const assertUnchanged = (): void => {
        assertCurrent();
        const currentDependencies = readConfig().dependencies;
        if (pkg.mainPkg !== main || pkg.mainEditorPkg() !== editor || editor.files[pxt.CONFIG_NAME] !== configFile
            || Object.keys(currentDependencies).length !== Object.keys(originalDependencies).length
            || Object.keys(originalDependencies).some(name => currentDependencies[name] !== originalDependencies[name])) {
            throw new Error(lf("The project extensions changed. Please try adding the snippet again."));
        }
    };
    const missing: string[] = [];
    for (const name of Object.keys(saved.dependencies)) {
        const dependency = main.deps[name];
        if (!dependency) missing.push(name);
        else if (dependency.cppOnly || dependency.config?.name !== name || !sameSource(dependency.version(), saved.dependencies[name])) {
            await explain(lf("Extension conflict"), lf("This snippet requires {0} ({1}), but this project has a different source for that extension. Resolve the conflict before adding the snippet.", name, saved.dependencies[name]));
            return false;
        }
    }

    if (missing.length) {
        const approved = await wait(() => core.confirmAsync({
            header: lf("Add required extensions?"),
            body: lf("This snippet requires the following extensions:\n{0}", missing.map(name => `${name}: ${saved.dependencies[name]}`).join("\n")),
            agreeLbl: lf("Add extensions and snippet")
        }));
        if (!approved) return false;
        assertUnchanged();

        // Fetch and check the entire dependency graph before any project write. In particular,
        // findConflictsAsync alone silently accepts null transitive configs and follows cycles.
        const planned = new Map<string, RequiredPackage>();
        const pending = missing.map(name => ({ name, version: saved.dependencies[name] }));
        while (pending.length) {
            assertUnchanged();
            const { name, version } = pending.shift();
            validateDependencies({ [name]: version });
            const installed = main.deps[name];
            const previous = planned.get(name);
            if (installed || previous) {
                if (installed && (installed.cppOnly || installed.config?.name !== name)
                    || !sameSource(installed ? installed.version() : previous.version, version)) {
                    await explain(lf("Extension conflict"), lf("The required extensions use different sources for '{0}'. No extensions were changed.", name));
                    return false;
                }
                continue;
            }
            if (planned.size >= 100) throw new Error(lf("This snippet requires too many extensions."));
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
                throw new Error(lf("The extension '{0}' returned an invalid or mismatched configuration.", name));
            }
            // This flag governs editor extensions, not ordinary block APIs on GitHub.
            if (config.extension && !pxt.appTarget.appTheme?.allowPackageExtensions) {
                await explain(lf("Extensions are unavailable"), lf("This editor does not allow the editor extension '{0}'.", name));
                return false;
            }
            planned.set(name, { name, version, config });
            pending.push(...Object.keys(config.dependencies).map(name => ({ name, version: config.dependencies[name] })));
        }

        // Use the existing conflict engine against a read-only prospective graph. Refuse ALL
        // replacements (including core and in-use packages), rather than bypassing confirmation.
        // Empty dependency maps prevent a second, unguarded recursive fetch during preflight.
        const prospective: pxt.MainPackage = Object.create(main);
        prospective.parent = prospective;
        const dependencies = main.sortedDeps().slice();
        prospective.sortedDeps = () => dependencies;
        for (const required of planned.values()) {
            const conflicts = await wait(() => prospective.findConflictsAsync({ ...required.config, dependencies: {} }, required.version));
            assertUnchanged();
            if (conflicts.length) {
                await explain(lf("Extension conflict"), lf("Adding '{0}' would replace or conflict with another extension. Resolve the conflict before adding this snippet. No extensions were changed.", required.name));
                return false;
            }
            const dependency = new pxt.Package(required.name, required.version, prospective, prospective, required.name);
            dependency.config = required.config;
            dependencies.push(dependency);
        }

        await wait(host.saveAsync); // Preserve current blocks AND TypeScript before the reload.
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
            // setContentAsync updates synchronously and starts saving this captured EditorPackage.
            // Unlike addDependencyAsync/setDependencyAsync, there is no later unguarded write.
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
            try { await wait(host.reloadAsync); }
            catch (error) { if (!writeFailed) throw error; }
        }
        if (writeFailed) throw writeError;
        assertCurrent();
    }

    if (await wait(missingProjectCode)) return false;
    assertCurrent();
    for (const name of Object.keys(saved.dependencies)) {
        const dependency = pkg.mainPkg.deps[name];
        if (!dependency || dependency.cppOnly || dependency.config?.name !== name
            || !sameSource(dependency.version(), saved.dependencies[name])) {
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
    pxtblockly.pasteBackpackBlock(saved.code, host.getWorkspace()); // Owns the single undo group and asset remapping.
    await wait(() => Blockly.renderManagement.finishQueuedRenders());
    await wait(host.saveAsync);
    assertCurrent();
    return true;
}