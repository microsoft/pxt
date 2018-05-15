namespace pxt.patching {
    export function computePatches(version: string, kind?: string): ts.pxtc.UpgradePolicy[] {
        const patches = pxt.appTarget.compile ? pxt.appTarget.compile.patches : undefined;
        if (!patches) return undefined;
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
        const upgrades = pxt.patching.computePatches(pkgTargetVersion, "api");
        let updatedContents = fileContents;
        if (upgrades) {
            upgrades.forEach(rule => {
                for (const match in rule.map) {
                    const regex = new RegExp(match, 'g');
                    updatedContents = updatedContents.replace(regex, rule.map[match]);
                }
            });
        }
        return updatedContents;
    }
}