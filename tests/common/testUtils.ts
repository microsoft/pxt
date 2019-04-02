/// <reference path="../../built/pxtlib.d.ts"/>
/// <reference path="../../built/pxtcompiler.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';

export function getFilesByExt(dir: string, ext: string): string[] {
    return fs.readdirSync(dir)
        .filter(f => f[0] != ".")
        .filter(f => f.substr(-ext.length) === ext)
        .map(f => path.join(dir, f))
}

export const testAppTarget: pxt.TargetBundle = {
    id: "core",
    name: "Microsoft MakeCode",
    title: "Microsoft MakeCode",
    versions: undefined,
    description: "A toolkit to build JavaScript Blocks editors.",
    bundleddirs: [],
    compile: {
        isNative: false,
        hasHex: false,
        jsRefCounting: true,
        switches: {}
    },
    bundledpkgs: {},
    appTheme: {},
    tsprj: undefined,
    blocksprj: undefined,
    runtime: {
        pauseUntilBlock: { category: "Loops", color: "0x0000ff" },
        bannedCategories: ["banned"]
    },
    corepkg: undefined
}