/// <reference path="../../built/pxtlib.d.ts"/>
/// <reference path="../../built/pxtwinrt.d.ts"/>
import * as core from "./core";
import * as pkg from "./package";
import Cloud = pxt.Cloud;

function browserDownloadDeployCoreAsync(resp: ts.pxt.CompileResult): Promise<void> {
    let hex = resp.outfiles["microbit.hex"]
    let fn = "microbit-" + pkg.mainEditorPkg().header.name.replace(/[^a-zA-Z0-9]+/, "-") + ".hex"
    console.log('saving ' + fn)
    core.browserDownloadText(hex, fn, "application/x-microbit-hex")
    return Promise.resolve();
}

function localhostDeployCoreAsync(resp: ts.pxt.CompileResult): Promise<void> {
    console.log('local deployment...');
    core.infoNotification("Uploading .hex file...");
    return Util.requestAsync({
        url: "http://localhost:3232/api/deploy",
        headers: { "Authorization": Cloud.localToken },
        method: "POST",
        data: resp
    }).then(r => {});
}

export function initCommandsAsync(): Promise<void> {
    if (pxtwinrt.isWinRT()) {
        console.log('using winrt commands')
        pxt.commands.deployCoreAsync = pxtwinrt.deployCoreAsync;
    } else if (Cloud.isLocalHost() && Cloud.localToken) {
        pxt.commands.deployCoreAsync = localhostDeployCoreAsync;
    } else {
        pxt.commands.deployCoreAsync = browserDownloadDeployCoreAsync;
    }
    return Promise.resolve();
}