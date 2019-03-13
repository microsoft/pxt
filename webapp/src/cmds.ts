/// <reference path="../../built/pxtlib.d.ts"/>
import * as core from "./core";
import * as electron from "./electron";
import * as pkg from "./package";
import * as hidbridge from "./hidbridge";
import * as webusb from "./webusb";
import Cloud = pxt.Cloud;

function browserDownloadAsync(text: string, name: string, contentType: string): Promise<void> {
    pxt.BrowserUtils.browserDownloadBinText(
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
    const ext = pxt.outputName().replace(/[^.]*/, "")
    const out = resp.outfiles[pxt.outputName()]
    const fn = pkg.genFileName(ext);
    const userContext = pxt.BrowserUtils.isBrowserDownloadWithinUserContext();
    if (userContext) {
        url = pxt.BrowserUtils.toDownloadDataUri(pxt.isOutputText() ? ts.pxtc.encodeBase64(out) : out, pxt.appTarget.compile.hexMimeType);
    } else if (!pxt.isOutputText()) {
        pxt.debug('saving ' + fn)
        url = pxt.BrowserUtils.browserDownloadBase64(
            out,
            fn,
            "application/x-uf2",
            resp.userContextWindow,
            e => core.errorNotification(lf("saving file failed..."))
        );
    } else {
        pxt.debug('saving ' + fn)
        url = pxt.BrowserUtils.browserDownloadBinText(
            out,
            fn,
            pxt.appTarget.compile.hexMimeType,
            resp.userContextWindow,
            e => core.errorNotification(lf("saving file failed..."))
        );
    }

    if (!resp.success) {
        return Promise.resolve();
    }

    if (resp.saveOnly && userContext) return pxt.commands.showUploadInstructionsAsync(fn, url, core.confirmAsync); // save does the same as download as far iOS is concerned
    if (resp.saveOnly || pxt.BrowserUtils.isBrowserDownloadInSameWindow() && !userContext) return Promise.resolve();
    else return pxt.commands.showUploadInstructionsAsync(fn, url, core.confirmAsync);
}

function showUploadInstructionsAsync(fn: string, url: string, confirmAsync: (options: any) => Promise<number>): Promise<void> {
    const boardName = pxt.appTarget.appTheme.boardName || lf("device");
    const boardDriveName = pxt.appTarget.appTheme.driveDisplayName || pxt.appTarget.compile.driveName || "???";

    // https://msdn.microsoft.com/en-us/library/cc848897.aspx
    // "For security reasons, data URIs are restricted to downloaded resources.
    // Data URIs cannot be used for navigation, for scripting, or to populate frame or iframe elements"
    const userDownload = pxt.BrowserUtils.isBrowserDownloadWithinUserContext();
    const downloadAgain = !pxt.BrowserUtils.isIE() && !pxt.BrowserUtils.isEdge();
    const docUrl = pxt.appTarget.appTheme.usbDocs;
    const saveAs = pxt.BrowserUtils.hasSaveAs();
    const ext = pxt.appTarget.compile.useUF2 ? ".uf2" : ".hex";
    const body = userDownload ? lf("Click 'Download' to open the {0} app.", pxt.appTarget.appTheme.boardName) :
        saveAs ? lf("Click 'Save As' and save the {0} file to the {1} drive to transfer the code into your {2}.",
            ext,
            boardDriveName, boardName)
            : lf("Move the {0} file to the {1} drive to transfer the code into your {2}.",
                ext,
                boardDriveName, boardName);
    const timeout = pxt.BrowserUtils.isBrowserDownloadWithinUserContext() ? 0 : 10000;
    return confirmAsync({
        header: userDownload ? lf("Download ready...") : lf("Download completed..."),
        body,
        hasCloseIcon: true,
        hideCancel: true,
        hideAgree: true,
        buttons: [downloadAgain ? {
            label: userDownload ? lf("Download") : fn,
            icon: "download",
            class: `${userDownload ? "primary" : "lightgrey"}`,
            url,
            fileName: fn
        } : undefined, docUrl ? {
            label: lf("Help"),
            icon: "help",
            class: "lightgrey",
            url: docUrl
        } : undefined],
        timeout
    }).then(() => { });
}

export function nativeHostPostMessageFunction(): (msg: pxt.editor.NativeHostMessage) => void {
    const webkit = (<any>window).webkit;
    if (webkit
        && webkit.messageHandlers
        && webkit.messageHandlers.host
        && webkit.messageHandlers.host.postMessage)
        return msg => webkit.messageHandlers.host.postMessage(msg);
    const android = (<any>window).android;
    if (android && android.postMessage)
        return msg => android.postMessage(JSON.stringify(msg));
    return undefined;
}

export function isNativeHost(): boolean {
    return !!nativeHostPostMessageFunction();
}

function nativeHostDeployCoreAsync(resp: pxtc.CompileResult): Promise<void> {
    pxt.debug(`native deploy`)
    core.infoNotification(lf("Flashing device..."));
    const out = resp.outfiles[pxt.outputName()];
    const nativePostMessage = nativeHostPostMessageFunction();
    nativePostMessage(<pxt.editor.NativeHostMessage>{
        name: resp.downloadFileBaseName,
        download: out
    })
    return Promise.resolve();
}

function nativeHostSaveCoreAsync(resp: pxtc.CompileResult): Promise<void> {
    pxt.debug(`native save`)
    core.infoNotification(lf("Saving file..."));
    const out = resp.outfiles[pxt.outputName()]
    const nativePostMessage = nativeHostPostMessageFunction();
    nativePostMessage(<pxt.editor.NativeHostMessage>{
        name: resp.downloadFileBaseName,
        save: out
    })
    return Promise.resolve();
}

export function hidDeployCoreAsync(resp: pxtc.CompileResult, d?: pxt.commands.DeployOptions): Promise<void> {
    pxt.tickEvent(`hid.deploy`)
    // error message handled in browser download
    if (!resp.success)
        return browserDownloadDeployCoreAsync(resp);
    core.infoNotification(lf("Downloading..."));
    let f = resp.outfiles[pxtc.BINARY_UF2]
    let blocks = pxtc.UF2.parseFile(pxt.Util.stringToUint8Array(atob(f)))
    return hidbridge.initAsync()
        .then(dev => dev.reflashAsync(blocks))
        .catch((e) => {
            const troubleshootDoc = pxt.appTarget && pxt.appTarget.appTheme && pxt.appTarget.appTheme.appFlashingTroubleshoot;
            if (e.type === "repairbootloader") {
                return pairBootloaderAsync()
                    .then(() => hidDeployCoreAsync(resp))
            }
            if (e.type === "devicenotfound" && d.reportDeviceNotFoundAsync && !!troubleshootDoc) {
                pxt.tickEvent("hid.flash.devicenotfound");
                return d.reportDeviceNotFoundAsync(troubleshootDoc, resp);
            } else {
                return pxt.commands.saveOnlyAsync(resp);
            }
        });
}

function pairBootloaderAsync(): Promise<void> {
    return core.confirmAsync({
        header: lf("Just one more time..."),
        body: lf("You need to pair the board again, now in bootloader mode. We know..."),
        agreeLbl: lf("Ok, pair!")
    }).then(r => pxt.usb.pairAsync())
}

function winrtDeployCoreAsync(r: pxtc.CompileResult, d: pxt.commands.DeployOptions): Promise<void> {
    return hidDeployCoreAsync(r, d)
        .timeout(20000)
        .catch((e) => {
            return hidbridge.disconnectWrapperAsync()
                .catch((e) => {
                    // Best effort disconnect; at this point we don't even know the state of the device
                    pxt.reportException(e);
                })
                .then(() => {
                    return core.confirmAsync({
                        header: lf("Something went wrong..."),
                        body: lf("Flashing your {0} took too long. Please disconnect your {0} from your computer and try reconnecting it.", pxt.appTarget.appTheme.boardName || lf("device")),
                        disagreeLbl: lf("Ok"),
                        hideAgree: true
                    });
                })
                .then(() => {
                    return pxt.commands.saveOnlyAsync(r);
                });
        });
}

function localhostDeployCoreAsync(resp: pxtc.CompileResult): Promise<void> {
    pxt.debug('local deployment...');
    core.infoNotification(lf("Uploading .hex file..."));
    let deploy = () => pxt.Util.requestAsync({
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

export function init(): void {
    pxt.onAppTargetChanged = init;
    pxt.commands.browserDownloadAsync = browserDownloadAsync;
    pxt.commands.saveOnlyAsync = browserDownloadDeployCoreAsync;
    pxt.commands.showUploadInstructionsAsync = showUploadInstructionsAsync;
    const forceHexDownload = /forceHexDownload/i.test(window.location.href);

    if (pxt.usb.isAvailable() && pxt.appTarget.compile.webUSB) {
        pxt.debug(`enabled webusb`);
        pxt.usb.setEnabled(true);
        pxt.HF2.mkPacketIOAsync = pxt.usb.mkPacketIOAsync;
    } else {
        pxt.debug(`disabled webusb`);
        pxt.usb.setEnabled(false);
        pxt.HF2.mkPacketIOAsync = hidbridge.mkBridgeAsync;
    }

    const shouldUseWebUSB = pxt.usb.isEnabled && pxt.appTarget.compile.useUF2;
    if (isNativeHost()) {
        pxt.debug(`deploy: webkit host`);
        pxt.commands.deployCoreAsync = nativeHostDeployCoreAsync;
        pxt.commands.saveOnlyAsync = nativeHostSaveCoreAsync;
    } else if (shouldUseWebUSB && pxt.appTarget.appTheme.autoWebUSBDownload) {
        pxt.debug(`deploy: webusb`);
        pxt.commands.deployCoreAsync = webusb.webUsbDeployCoreAsync;
    } else if (pxt.winrt.isWinRT()) { // windows app
        if (pxt.appTarget.serial && pxt.appTarget.serial.useHF2) {
            pxt.debug(`deploy: winrt`);
            pxt.winrt.initWinrtHid(() => hidbridge.initAsync(true).then(() => { }), () => hidbridge.disconnectWrapperAsync());
            pxt.HF2.mkPacketIOAsync = pxt.winrt.mkPacketIOAsync;
            pxt.commands.deployCoreAsync = winrtDeployCoreAsync;
        } else {
            // If we're not using HF2, then the target is using their own deploy logic in extension.ts, so don't use
            // the wrapper callbacks
            pxt.debug(`deploy: winrt + custom deploy`);
            pxt.winrt.initWinrtHid(null, null);
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
                .catch((e) => core.errorNotification(lf("saving file failed...")));
        };
    } else if (pxt.BrowserUtils.isPxtElectron()) {
        pxt.debug(`deploy: electron`);
        pxt.commands.deployCoreAsync = electron.driveDeployAsync;
        pxt.commands.electronDeployAsync = electron.driveDeployAsync;
    } else if (!shouldUseWebUSB && hidbridge.shouldUse() && !pxt.appTarget.serial.noDeploy && !forceHexDownload) {
        pxt.debug(`deploy: hid`);
        pxt.commands.deployCoreAsync = hidDeployCoreAsync;
    } else if (pxt.BrowserUtils.isLocalHost() && Cloud.localToken && !forceHexDownload) { // local node.js
        pxt.debug(`deploy: localhost`);
        pxt.commands.deployCoreAsync = localhostDeployCoreAsync;
    } else { // in browser
        pxt.debug(`deploy: browser`);
        pxt.commands.deployCoreAsync = browserDownloadDeployCoreAsync;
    }
}
