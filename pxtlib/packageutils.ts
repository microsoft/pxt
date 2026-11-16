namespace pxt.packageUtils {
    import U = pxtc.Util;

    export function getVersionProtocol(version: string): string {
        const separator = version.indexOf(":");
        return separator < 0 ? "" : version.slice(0, separator);
    }

    export function isVariantDisabled(config: PackageConfig, variant: string): boolean {
        return !!config && !!config.disablesVariants && config.disablesVariants.indexOf(variant) >= 0;
    }

    /** Removes obsolete native build settings from a parsed package config, warning for each field. */
    export function removeUnsupportedPackageConfigFields(
        config: PackageConfig,
        filename: string,
        warn: (message: string) => void
    ): void {
        const legacy: PackageConfig & { npmDependencies?: unknown; platformio?: unknown } = config;
        for (const field of ["npmDependencies", "platformio"] as const) {
            if (Object.prototype.hasOwnProperty.call(legacy, field)) {
                warn(`${filename}: "${field}" is no longer supported and will be ignored.`);
                delete legacy[field];
            }
        }
    }

    export function getConfigDependencies(
        config: PackageConfig,
        includeTests: boolean,
        includeCpp: boolean,
        isTestDependencyAvailable: (id: string, version: string) => boolean
    ): Map<string> {
        if (!config) return {};
        const dependencies = { ...config.dependencies };
        if (includeTests) {
            for (const id of Object.keys(config.testDependencies || {})) {
                const version = config.testDependencies[id];
                if (isTestDependencyAvailable(id, version))
                    dependencies[id] = version;
            }
        }
        if (includeCpp)
            U.jsonMergeFrom(dependencies, config.cppDependencies);
        return dependencies;
    }

    /** Evaluates fileDependencies with && taking precedence over ||, without reading target or package globals. */
    export function evaluateDependencyCondition(
        condition: string,
        target: Pick<AppTarget, "id" | "platformid">,
        hasDependency: (id: string) => boolean,
        onInvalidCondition: (condition: string) => void
    ): boolean {
        if (!condition || !condition.trim()) return true;
        const evaluate = (term: string): boolean => {
            term = term.trim();
            if (term[0] == "!") return !evaluate(term.slice(1));
            if (/^[\w-]+$/.test(term)) return hasDependency(term);
            const match = /^target:(\w+)$/.exec(term);
            if (match) return match[1] == target.id || match[1] == target.platformid;
            onInvalidCondition(term);
            return false;
        };
        return condition.split("||").some(c => c.split("&&").every(evaluate));
    }

    export function getConfigFiles(
        config: PackageConfig,
        includeTests: boolean,
        target: Pick<AppTarget, "id" | "platformid">,
        hasDependency: (id: string) => boolean,
        onInvalidCondition: (condition: string, filename: string) => void
    ): string[] {
        const files = config.files.concat(includeTests ? config.testFiles || [] : []);
        if (!config.fileDependencies) return files;
        return files.filter(filename => evaluateDependencyCondition(
            U.lookup(config.fileDependencies, filename),
            target,
            hasDependency,
            condition => onInvalidCondition(condition, filename)
        ));
    }

    export function getProjectFiles(mainPkg: MainPackage) {
        const extensionFiles: Map<string> = {};

        for (const pkg of mainPkg.sortedDeps(true)) {
            const prefix = pkg == mainPkg ? "" : "pxt_modules/" + pkg.id + "/";
            const config = clone(pkg.config);
            const resolveVersions = (deps: Map<string>): Map<string> => {
                const result: Map<string> = {};
                for (const id of Object.keys(deps || {})) {
                    const dep = pkg.resolveDep(id);
                    if (dep) result[id] = dep.version();
                }
                return result;
            };
            config.dependencies = resolveVersions(pkg.dependencies());
            config.cppDependencies = resolveVersions(config.cppDependencies);
            // testDependencies are merged into the main dependencies by pkg.dependencies(), so
            // it's safe to delete them from the config object here
            delete config.testDependencies;
            if (pkg != mainPkg || pkg.ignoreTests) {
                delete config.testFiles;
            }
            extensionFiles[prefix + pxt.CONFIG_NAME] = JSON.stringify(config);
            for (const fn of config.files.concat(config.testFiles || []))
                extensionFiles[prefix + fn] = pkg.readFile(fn);
        }

        return extensionFiles;
    }

    function clone<T>(v: T): T {
        if (v == null) return null
        return JSON.parse(JSON.stringify(v))
    }
}
