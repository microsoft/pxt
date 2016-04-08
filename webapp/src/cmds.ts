/// <reference path="../../built/pxtlib.d.ts"/>
import * as core from "./core";
import * as pkg from "./package";
import Cloud = pxt.Cloud;

function browserDownloadDeployCoreAsync(resp: ts.pxt.CompileResult) : Promise<void> {
    let hex = resp.outfiles["microbit.hex"]
    if (hex) {
        let fn = "microbit-" + pkg.mainEditorPkg().header.name.replace(/[^a-zA-Z0-9]+/, "-") + ".hex"
        console.log('saving ' + fn)
        core.browserDownloadText(hex, fn, "application/x-microbit-hex")
    } else {
        core.warningNotification(lf("Oops, we could not compile this project. Please check your code for errors."))
    }
    return Promise.resolve();
}

function localhostDeployCoreAsync(resp: ts.pxt.CompileResult) : Promise<void> {
    let hex = resp.outfiles["microbit.hex"]
    if (hex) {
        console.log('local deployment...');
        core.infoNotification("Uploading .hex file...");
        return Util.requestAsync({
            url: "http://localhost:3232/api/deploy",
            headers: { "Authorization": Cloud.localToken },
            method: "POST",
            data: resp
        }).then(() => {
            core.infoNotification(lf(".hex file uploaded..."));
        }, () => {
            core.warningNotification(lf("Oops, something went wrong while deploying the .hex file..."));
        })
    } else {
        core.warningNotification(lf("Oops, we could not compile this project. Please check your code for errors."))
        return Promise.resolve();
    }
}

export function initCommandsAsync() : Promise<void> {
    pxt.commands.deployCoreAsync = 
        Cloud.isLocalHost() && Cloud.localToken 
        ? localhostDeployCoreAsync 
        : browserDownloadDeployCoreAsync;
        
    return Promise.resolve();
}