

import * as core from "./core";
import * as pkg from "./package";
import * as screenshot from "./screenshot";

export function isHexFile(filename: string): boolean {
    return /\.(hex|uf2)$/i.test(filename)
}

export function isBlocksFile(filename: string): boolean {
    return /\.blocks$/i.test(filename)
}

export function isTypescriptFile(filename: string): boolean {
    return /\.ts$/i.test(filename);
}

export function isProjectFile(filename: string): boolean {
    return /\.(pxt|mkcd)$/i.test(filename)
}

export function isPNGFile(filename: string): boolean {
    return pxt.appTarget.compile.saveAsPNG && /\.png$/i.test(filename);
}

export function isAssetFile(filename: string): boolean {
    let exts = pxt.appTarget.runtime ? pxt.appTarget.runtime.assetExtensions : null
    if (exts) {
        let ext = filename.replace(/.*\./, "").toLowerCase()
        return exts.indexOf(ext) >= 0
    }
    return false
}

export function importProjectCoreAsync(buf: Uint8Array) {
    return pxt.lzmaDecompressAsync(buf)
        .then(contents => {
            let data = JSON.parse(contents) as pxt.cpp.HexFile;
            this.importHex(data);
        }).catch(e => {
            core.warningNotification(lf("Sorry, we could not import this project."))
            this.openHome();
        });
}

export function importHexFile(file: File) {
    if (!file) return;
    pxt.cpp.unpackSourceFromHexFileAsync(file)
        .done(data => this.importHex(data));
}

export function importBlocksFiles(file: File) {
    if (!file) return;
    ts.pxtc.Util.fileReadAsTextAsync(file)
        .done(contents => {
            this.newProject({
                filesOverride: { "main.blocks": contents, "main.ts": "  " },
                name: file.name.replace(/\.blocks$/i, '') || lf("Untitled")
            })
        })
}

export function importTypescriptFile(file: File) {
    if (!file) return;
    ts.pxtc.Util.fileReadAsTextAsync(file)
        .done(contents => {
            this.newProject({
                filesOverride: { "main.blocks": '', "main.ts": contents || "  " },
                name: file.name.replace(/\.ts$/i, '') || lf("Untitled")
            })
        })
}

export function importProjectFile(file: File) {
    if (!file) return;
    ts.pxtc.Util.fileReadAsBufferAsync(file)
        .then(buf => this.importProjectCoreAsync(buf))
}

export function importPNGFile(file: File) {
    if (!file) return;
    ts.pxtc.Util.fileReadAsBufferAsync(file)
        .then(buf => screenshot.decodeBlobAsync("data:image/png;base64," +
            btoa(pxt.Util.uint8ArrayToString(buf))))
        .then(buf => this.importProjectCoreAsync(buf))
}

export function importAssetFile(file: File) {
    ts.pxtc.Util.fileReadAsBufferAsync(file)
        .then(buf => {
            let basename = file.name.replace(/.*[\/\\]/, "")
            return pkg.mainEditorPkg().saveAssetAsync(basename, buf)
        })
        .done()
}