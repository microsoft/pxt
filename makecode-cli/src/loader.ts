import * as mkc from "./mkc"

interface TargetDescriptor {
    id: string;
    website: string;
    corepkg: string;
    label?: string;
}

const descriptors: TargetDescriptor[] = [{
    id: "arcade",
    website: "https://arcade.makecode.com/beta",
    corepkg: "device",
}, {
    id: "microbit",
    website: "https://makecode.microbit.org",
    corepkg: "core",
}, {
    id: "adafruit",
    website: "https://makecode.adafruit.com",
    corepkg: "circuit-playground",
}]

export function guessMkcJson(prj: pxt.PackageConfig, mkc: mkc.MkcJson) {
    const ver = prj.targetVersions || { target: "" }

    const theTarget = descriptors.filter(d => d.id == ver.targetId)[0]
        || descriptors.filter(d => d.website == ver.targetWebsite)[0]
        || descriptors.filter(d => !!prj.dependencies[d.corepkg])[0]

    if (!mkc.targetWebsite) {
        if (ver.targetWebsite) {
            mkc.targetWebsite = ver.targetWebsite
        } else if (theTarget) {
            mkc.targetWebsite = theTarget.website
        } else {
            throw new Error("Cannot determine target; please use mkc.json to specify")
        }
    }
}
