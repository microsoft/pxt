namespace pxt.patching {
    export function computePatches(version: string, kind?: string): ts.pxtc.UpgradePolicy[] {
        const patches = pxt.appTarget.compile ? pxt.appTarget.compile.patches : undefined;
        if (!patches) return undefined;
        const v = pxt.semver.tryParse(version || "0.0.0") || pxt.semver.tryParse("0.0.0");
        let r: ts.pxtc.UpgradePolicy[] = [];
        Object.keys(patches)
            .filter(rng => pxt.semver.inRange(rng, v))
            .forEach(rng => r.concat(patches[rng]));
        if (kind)
            r = r.filter(p => p.type == kind);
        return r.length ? r : undefined;
    }
}