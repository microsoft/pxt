/// <reference path="../../built/pxtlib.d.ts"/>
import * as core from "./core";
import * as pkg from "./package";
import * as hidbridge from "./hidbridge";
import Cloud = pxt.Cloud;

function browserDownloadAsync(text: string, name: string, contentType: string): Promise<void> {
    let url = pxt.BrowserUtils.browserDownloadBinText(
        text,
        name,
        contentType,
        undefined,
        e => core.errorNotification(lf("saving file failed..."))
    );

    return Promise.resolve();
}

export function browserDownloadDeployCoreAsync(resp: pxtc.CompileResult): Promise<void> {
    let url = ""
    let fn = ""
    let ext = pxt.outputName().replace(/[^.]*/, "")
    if (!pxt.isOutputText()) {
        let uf2 = resp.outfiles[pxt.outputName()]
        fn = pkg.genFileName(ext);
        pxt.debug('saving ' + fn)
        url = pxt.BrowserUtils.browserDownloadBase64(
            uf2,
            fn,
            "application/x-uf2",
            resp.userContextWindow,
            e => core.errorNotification(lf("saving file failed..."))
        );
    } else {
        let hex = resp.outfiles[pxt.outputName()]
        fn = pkg.genFileName(ext);
        pxt.debug('saving ' + fn)
        url = pxt.BrowserUtils.browserDownloadBinText(
            hex,
            fn,
            pxt.appTarget.compile.hexMimeType,
            resp.userContextWindow,
            e => core.errorNotification(lf("saving file failed..."))
        );
    }

    if (!resp.success) {
        return core.confirmAsync({
            header: lf("Compilation failed"),
            body: lf("Ooops, looks like there are errors in your program."),
            hideAgree: true,
            disagreeLbl: lf("Close")
        }).then(() => { });
    }

    if (resp.saveOnly || pxt.BrowserUtils.isBrowserDownloadInSameWindow()) return Promise.resolve();
    else return pxt.commands.showUploadInstructionsAsync(fn, url, core.confirmAsync);
}

function showUploadInstructionsAsync(fn: string, url: string, confirmAsync?: (options: any) => Promise<number>): Promise<void> {
    const boardName = pxt.appTarget.appTheme.boardName || "???";
    const boardDriveName = pxt.appTarget.appTheme.driveDisplayName || pxt.appTarget.compile.driveName || "???";

    // https://msdn.microsoft.com/en-us/library/cc848897.aspx
    // "For security reasons, data URIs are restricted to downloaded resources. 
    // Data URIs cannot be used for navigation, for scripting, or to populate frame or iframe elements"
    const downloadAgain = !pxt.BrowserUtils.isIE() && !pxt.BrowserUtils.isEdge();
    const docUrl = pxt.appTarget.appTheme.usbDocs;
    const saveAs = pxt.BrowserUtils.hasSaveAs();
    const useUF2 = pxt.appTarget.compile.useUF2;
    let body = saveAs ? lf("Click 'Save As' and save the {0} file to the {1} drive to transfer the code into your {2}.",
        useUF2 ? ".uf2" : ".hex",
        boardDriveName, boardName)
        : lf("Move the {0} file to the {1} drive to transfer the code into your {2}.",
            pxt.appTarget.compile.useUF2 ? ".uf2" : ".hex",
            boardDriveName, boardName);
    if (useUF2) body = lf("Press the `reset` button once on the {0}.", boardName) + " " + body;
    return confirmAsync({
        header: lf("Download completed..."),
        body,
        hideCancel: true,
        hideAgree: true,
        buttons: [downloadAgain ? {
            label: fn,
            icon: "download",
            class: "lightgrey focused",
            url,
            fileName: fn
        } : undefined, docUrl ? {
            label: lf("Help"),
            icon: "help",
            class: "lightgrey focused",
            url: docUrl
        } : undefined],
        timeout: 10000
    }).then(() => { });
}

function webusbDeployCoreAsync(resp: pxtc.CompileResult): Promise<void> {
    pxt.debug('webusb deployment...');
    core.infoNotification(lf("Flashing device..."));
    let f = resp.outfiles[pxtc.BINARY_UF2]
    let blocks = pxtc.UF2.parseFile(Util.stringToUint8Array(atob(f)))
    return pxt.usb.initAsync()
        .then(dev => dev.reflashAsync(blocks))
}

function hidDeployCoreAsync(resp: pxtc.CompileResult): Promise<void> {
    pxt.debug('HID deployment...');
    core.infoNotification(lf("Flashing device..."));
    let f = resp.outfiles[pxtc.BINARY_UF2]
    let blocks = pxtc.UF2.parseFile(Util.stringToUint8Array(atob(f)))
    return hidbridge.initAsync()
        .then(dev => dev.reflashAsync(blocks))
}

function localhostDeployCoreAsync(resp: pxtc.CompileResult): Promise<void> {
    pxt.debug('local deployment...');
    core.infoNotification(lf("Uploading .hex file..."));
    let deploy = () => Util.requestAsync({
        url: "/api/deploy",
        headers: { "Authorization": Cloud.localToken },
        method: "POST",
        data: resp,
        allowHttpErrors: true // To prevent "Network request failed" warning in case of error. We're not actually doing network requests in localhost scenarios
    }).then(r => {
        if (r.statusCode !== 200) {
            core.errorNotification(lf("There was a problem, please try again"));
        } else if (r.json["boardCount"] === 0) {
            core.warningNotification(lf("Please connect your {0} to your computer and try again", pxt.appTarget.appTheme.boardName));
        }
    });

    return deploy()
}

export function initCommandsAsync(): Promise<void> {
    pxt.commands.browserDownloadAsync = browserDownloadAsync;
    pxt.commands.saveOnlyAsync = browserDownloadDeployCoreAsync;
    pxt.commands.showUploadInstructionsAsync = showUploadInstructionsAsync;
    const forceHexDownload = /forceHexDownload/i.test(window.location.href);

    if (/webusb=1/i.test(window.location.href) && pxt.appTarget.compile.useUF2) {
        pxt.commands.deployCoreAsync = webusbDeployCoreAsync;
    } else if (pxt.winrt.isWinRT()) { // windows app
        if (pxt.appTarget.serial && pxt.appTarget.serial.useHF2) {
            pxt.HF2.mkPacketIOAsync = pxt.winrt.mkPacketIOAsync;
            pxt.commands.deployCoreAsync = hidDeployCoreAsync;
        } else {
            if (pxt.appTarget.serial && pxt.appTarget.serial.rawHID) {
                pxt.HF2.mkPacketIOAsync = pxt.winrt.mkPacketIOAsync;
            }
            pxt.commands.deployCoreAsync = pxt.winrt.driveDeployCoreAsync;
        }
        pxt.commands.browserDownloadAsync = pxt.winrt.browserDownloadAsync;
        pxt.commands.saveOnlyAsync = (resp: pxtc.CompileResult) => {
            return pxt.winrt.saveOnlyAsync(resp)
                .then((saved) => {
                    if (saved) {
                        core.infoNotification(lf("file saved!"));
                    }
                })
                .catch(() => core.errorNotification(lf("saving file failed...")));
        };
    } else if (hidbridge.shouldUse() && !pxt.appTarget.serial.noDeploy && !forceHexDownload) {
        pxt.commands.deployCoreAsync = hidDeployCoreAsync;
    } else if (Cloud.isLocalHost() && Cloud.localToken && !forceHexDownload) { // local node.js
        pxt.commands.deployCoreAsync = localhostDeployCoreAsync;
    } else { // in browser
        pxt.commands.deployCoreAsync = browserDownloadDeployCoreAsync;
    }

    return Promise.resolve();
}
