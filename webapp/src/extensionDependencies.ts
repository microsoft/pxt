export type ExtensionIdentity = Pick<pxtc.service.ExtensionMeta, "pkgConfig" | "repo" | "fullRepo" | "scriptInfo"> & {
    dependencyName?: string;
    workspaceId?: string;
};

export interface InstalledDependency {
    name: string;
    version: string;
    direct: boolean;
    requiredBy: string[];
}

/** Looks up gallery cards by their source and tracks which direct packages require each dependency. */
export class InstalledExtensions {
    readonly directDependencies: readonly InstalledDependency[];
    private readonly byName = new Map<string, InstalledDependency>();
    private readonly bySource = new Map<string, InstalledDependency>();

    constructor(mainPackage: pxt.MainPackage) {
        const byPackage = new Map<pxt.Package, InstalledDependency>();
        const roots = Object.entries(mainPackage?.config?.dependencies || {}).map(([name, version]) => {
            const resolved = mainPackage.resolveDep(name);
            const dependency = this.add(name, resolved && !resolved.invalid() ? resolved.version() : version, true);
            if (resolved) byPackage.set(resolved, dependency);
            return { dependency, resolved };
        });
        this.directDependencies = roots.map(({ dependency }) => dependency);

        // Walk from each direct extension so shared dependencies are attributed to every root.
        for (const { dependency, resolved } of roots) {
            if (!resolved || resolved === mainPackage || resolved.invalid()) continue;

            const rootName = resolved.config?.displayName || resolved.config?.name || dependency.name;
            const visited = new Set<pxt.Package>([mainPackage, resolved]);
            const visit = (child: pxt.Package) => {
                if (!child?.config || visited.has(child) || child.invalid() || child.cppOnly) return;
                visited.add(child);
                let installed = byPackage.get(child);
                if (!installed) {
                    installed = this.add(child.id, child.version(), false);
                    byPackage.set(child, installed);
                }
                installed.requiredBy.push(rootName);
                child.resolvedDependencies().forEach(visit);
            };
            resolved.resolvedDependencies().forEach(visit);
        }
    }

    find(extension: ExtensionIdentity): InstalledDependency | undefined {
        if (extension.dependencyName) return this.byName.get(extension.dependencyName);
        if (extension.workspaceId) return this.bySource.get(`workspace:${extension.workspaceId}`);
        if (extension.scriptInfo?.id) return this.bySource.get(`pub:${extension.scriptInfo.id}`);

        const repo = pxt.github.parseRepoId(extension.repo?.fullName || extension.fullRepo);
        if (repo) return this.bySource.get(`github:${repo.fullName.toLowerCase()}`);

        if (extension.pkgConfig?.name) return this.bySource.get(`bundled:${extension.pkgConfig.name}`);
        return undefined;
    }

    private add(name: string, version: string, direct: boolean): InstalledDependency {
        const dependency: InstalledDependency = { name, version, direct, requiredBy: [] };
        this.byName.set(name, dependency);
        const repo = pxt.github.parseRepoId(version);
        const shareId = normalizedPublishedScriptId(version);
        const identity = shareId ? `pub:${shareId}`
            : repo ? `github:${repo.fullName.toLowerCase()}`
            : version?.startsWith("workspace:") ? version
            : !version || /^(?:embed:|file:|\*$)/.test(version) ? `bundled:${name}`
            : undefined;
        if (identity && !this.bySource.has(identity)) this.bySource.set(identity, dependency);
        return dependency;
    }
}

export function normalizedPublishedScriptId(version: string): string | undefined {
    if (!version) return undefined;
    if (version.startsWith("pub:")) return version.slice(4);
    return pxt.Cloud.parseScriptId(version);
}
