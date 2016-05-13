/// <reference path="../../built/pxtlib.d.ts"/>
/// <reference path="../../built/pxtwinrt.d.ts"/>
import * as core from "./core";
import * as pkg from "./package";
import Cloud = pxt.Cloud;

function browserDownloadAsync(text: string, name: string, contentType: string): Promise<void> {
    let url = pxt.BrowserUtils.browserDownloadText(
        text,
        name,
        contentType,
        e => core.errorNotification(lf("saving file failed..."))
    );

    $('#compilemsg').finish()
        .html(`${lf("Download ready.")} <a href='${encodeURI(url)}' download='${Util.htmlEscape(name)}' target='_blank'>${lf("Use this link to save to another location.")}</a>`)
        .fadeIn('fast').delay(7000).fadeOut('slow');

    return Promise.resolve();
}

function browserDownloadDeployCoreAsync(resp: ts.pxt.CompileResult): Promise<void> {
    let hex = resp.outfiles["microbit.hex"]
    let fn = "microbit-" + pkg.mainEditorPkg().header.name.replace(/[^a-zA-Z0-9]+/, "-") + ".hex"
    console.log('saving ' + fn)
    return pxt.commands.browserDownloadAsync(hex, fn, "application/x-microbit-hex")
}

function localhostDeployCoreAsync(resp: ts.pxt.CompileResult): Promise<void> {
    console.log('local deployment...');
    core.infoNotification("Uploading .hex file...");
    return Util.requestAsync({
        url: "http://localhost:3232/api/deploy",
        headers: { "Authorization": Cloud.localToken },
        method: "POST",
        data: resp
    }).then(r => { });
}

export function initCommandsAsync(): Promise<void> {
    if (pxtwinrt.isWinRT()) {
        console.log('using winrt commands')
        pxt.commands.deployCoreAsync = (resp) => {
            core.infoNotification("Uploading .hex file");
            return pxtwinrt.deployCoreAsync(resp)
                .then(() => {
                    core.infoNotification(".hex file upladed");
                })
        }
        pxt.commands.browserDownloadAsync = pxtwinrt.browserDownloadAsync;
    } else if (Cloud.isLocalHost() && Cloud.localToken) { // local node.js
        pxt.commands.deployCoreAsync = localhostDeployCoreAsync;
        pxt.commands.browserDownloadAsync = browserDownloadAsync;
    } else { // in browser
        pxt.commands.deployCoreAsync = browserDownloadDeployCoreAsync;
        pxt.commands.browserDownloadAsync = browserDownloadAsync;
    }

    return Promise.resolve();
}