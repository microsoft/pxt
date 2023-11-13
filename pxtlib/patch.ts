namespace pxt.patching {
    export function computePatches(version: string, kind?: string): ts.pxtc.UpgradePolicy[] {
        const patches = pxt.appTarget.compile ? pxt.appTarget.compile.patches : undefined;
        if (!patches) return undefined;
        return parsePatches(version, patches, kind);
    }

    export function computePyPatches(version: string, kind?: string): ts.pxtc.UpgradePolicy[] {
        const patches = pxt.appTarget.compile ? pxt.appTarget.compile.pyPatches : undefined;
        if (!patches) return undefined;
        return parsePatches(version, patches, kind);
    }

    function parsePatches(version: string, patches: Map<ts.pxtc.UpgradePolicy[]>, kind?: string): ts.pxtc.UpgradePolicy[] {
        const v = pxt.semver.tryParse(version || "0.0.0") || pxt.semver.tryParse("0.0.0");
        let r: ts.pxtc.UpgradePolicy[] = [];
        Object.keys(patches)
            .filter(rng => pxt.semver.inRange(rng, v))
            .forEach(rng => r = r.concat(patches[rng]));
        if (kind)
            r = r.filter(p => p.type == kind);
        return r.length ? r : undefined;
    }

    export function upgradePackageReference(pkgTargetVersion: string, pkg: string, val: string): string {
        if (val != "*") return pkg;
        const upgrades = pxt.patching.computePatches(pkgTargetVersion, "package");
        let newPackage = pkg;
        if (upgrades) {
            upgrades.forEach(rule => {
                    Object.keys(rule.map).forEach(match => {
                        if (newPackage == match) {
                            newPackage = rule.map[match];
                        }
                    });
                });
        }
        return newPackage;
    }

    export function patchJavaScript(pkgTargetVersion: string, fileContents: string): string {
        const upgrades = pxt.patching.computePatches(pkgTargetVersion);
        return patchTextCode(pkgTargetVersion, fileContents, upgrades);
    }

    export function patchPython(pkgTargetVersion: string, fileContents: string): string {
        const upgrades = pxt.patching.computePyPatches(pkgTargetVersion);
        return patchTextCode(pkgTargetVersion, fileContents, upgrades);
    }

    function patchTextCode(pkgTargetVersion: string, fileContents: string, upgrades: pxtc.UpgradePolicy[]): string {
        let updatedContents = fileContents;
        if (upgrades) {
            upgrades.filter(u => u.type === "api").forEach(rule => {
                Object.keys(rule.map).forEach(match => {
                    const regex = new RegExp(match, 'g');
                    updatedContents = updatedContents.replace(regex, rule.map[match]);
                });
            });
            upgrades.filter(u => u.type === "userenum").forEach(rule => {
                Object.keys(rule.map).forEach(enumName => {
                    const declRegex = new RegExp("enum\\s+" + enumName + "\\s*{", 'gm');
                    updatedContents = updatedContents.replace(declRegex, `enum ${rule.map[enumName]} {`);

                    const usageRegex = new RegExp(`(^|[^_a-zA-Z0-9])${enumName}(\\s*\\.)`, 'g');
                    updatedContents = updatedContents.replace(usageRegex, `$1${rule.map[enumName]}$2`);
                });
            });
        }
        return updatedContents;
    }
}