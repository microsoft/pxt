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

export function initGlobals(useBluebird: boolean = false) {
    if (useBluebird)
        Promise = require("bluebird");
    let g = global as any
    g.pxt = pxt;
    g.ts = ts;
    g.pxtc = pxtc;
    g.btoa = (str: string) => new Buffer(str, "binary").toString("base64");
    g.atob = (str: string) => new Buffer(str, "base64").toString("binary");
}