/// <reference path="../../localtypings/pxtpackage.d.ts"/>
/// <reference path="../commonutil.ts"/>

namespace pxt.packageUtils {
    import U = pxtc.Util;

    export function getVersionProtocol(version: string): string {
        const separator = version.indexOf(":");
        return separator < 0 ? "" : version.slice(0, separator);
    }

    export function isVariantDisabled(config: PackageConfig, variant: string): boolean {
        return !!config && !!config.disablesVariants && config.disablesVariants.indexOf(variant) >= 0;
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
}
