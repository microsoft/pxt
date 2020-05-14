/// <reference path="../../built/pxtlib.d.ts"/>
import * as core from "./core";
import * as electron from "./electron";
import * as pkg from "./package";
import * as hidbridge from "./hidbridge";
import * as webusb from "./webusb";
import * as data from "./data";
import Cloud = pxt.Cloud;

function log(msg: string) {
    pxt.log(`cmds: ${msg}`);
}

let extensionResult: pxt.editor.ExtensionResult;

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
        log('saving ' + fn)
        url = pxt.BrowserUtils.browserDownloadBase64(
            out,
            fn,
            "application/x-uf2",
            resp.userContextWindow,
            e => core.errorNotification(lf("saving file failed..."))
        );
    } else {
        log('saving ' + fn)
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

function showUploadInstructionsAsync(fn: string, url: string, confirmAsync: (options: core.PromptOptions) => Promise<number>): Promise<void> {
    const boardName = pxt.appTarget.appTheme.boardName || lf("device");
    const boardDriveName = pxt.appTarget.appTheme.driveDisplayName || pxt.appTarget.compile.driveName || "???";

    // https://msdn.microsoft.com/en-us/library/cc848897.aspx
    // "For security reasons, data URIs are restricted to downloaded resources.
    // Data URIs cannot be used for navigation, for scripting, or to populate frame or iframe elements"
    const userDownload = pxt.BrowserUtils.isBrowserDownloadWithinUserContext();
    const downloadAgain = !pxt.BrowserUtils.isIE() && !pxt.BrowserUtils.isEdge();
    const helpUrl = pxt.appTarget.appTheme.usbDocs;
    const saveAs = pxt.BrowserUtils.hasSaveAs();
    const ext = pxt.appTarget.compile.useUF2 ? ".uf2" : ".hex";
    const connect = pxt.usb.isEnabled && pxt.appTarget?.compile?.webUSB;
    const jsx = !userDownload && !saveAs && pxt.commands.renderBrowserDownloadInstructions && pxt.commands.renderBrowserDownloadInstructions();
    const body = userDownload ? lf("Click 'Download' to open the {0} app.", pxt.appTarget.appTheme.boardName) :
        saveAs ? lf("Click 'Save As' and save the {0} file to the {1} drive to transfer the code into your {2}.",
            ext,
            boardDriveName, boardName)
            : !jsx && lf("Move the {0} file to the {1} drive to transfer the code into your {2}.",
                ext,
                boardDriveName, boardName);
    const timeout = pxt.BrowserUtils.isBrowserDownloadWithinUserContext() ? 0 : 10000;
    return confirmAsync({
        header: userDownload ? lf("Download ready...") : lf("Download completed..."),
        body,
        jsx,
        hasCloseIcon: true,
        hideCancel: true,
        hideAgree: true,
        helpUrl,
        className: 'downloaddialog',
        buttons: [
            connect && {
                label: lf("Pair device"),
                icon: "usb",
                className: "ligthgrey",
                onclick: () => {
                    pxt.tickEvent('downloaddialog.pair')
                    core.hideDialog();
                    maybeReconnectAsync(true)
                }
            },
            downloadAgain && {
                label: userDownload ? lf("Download") : lf("Download again"),
                icon: "download",
                className: "primary",
                url,
                fileName: fn
            }],
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
    log(`native deploy`)
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
    log(`native save`)
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
    pxt.tickEvent(`hid.deploy`);
    log(`hid deploy`)
    // error message handled in browser download
    if (!resp.success)
        return browserDownloadDeployCoreAsync(resp);
    let isRetry = false;
    const LOADING_KEY = "hiddeploy";
    return deployAsync();

    function deployAsync(): Promise<void> {
        return pxt.packetio.initAsync(isRetry)
            .then(dev => core.showLoadingAsync(LOADING_KEY, lf("Downloading..."),
                dev.reflashAsync(resp)
                    .then(() => dev.reconnectAsync()), 5000))
            .then(() => core.infoNotification("Download completed!"))
            .finally(() => core.hideLoading(LOADING_KEY))
            .timeout(120000, "timeout") // packetio should time out first
            .catch((e) => {
                if (e.type === "repairbootloader") {
                    return pairBootloaderAsync()
                        .then(() => hidDeployCoreAsync(resp))
                } else if (e.message === "timeout") {
                    pxt.tickEvent("hid.flash.timeout");
                    log(`flash timeout`);
                } else if (e.type === "devicenotfound") {
                    pxt.tickEvent("hid.flash.devicenotfound");
                    // no device, just save
                    log(`device not found`);
                    return pxt.commands.saveOnlyAsync(resp);
                } else if (e.code == 19 || e.type === "devicelocked") {
                    // device is locked or used by another tab
                    pxt.tickEvent("hid.flash.devicelocked");
                    log(`error: device locked`);
                    return pxt.commands.saveOnlyAsync(resp);
                } else {
                    pxt.tickEvent("hid.flash.error");
                    pxt.reportException(e)
                    if (d) d.reportError(e.message);
                }

                // disconnect and try again
                if (!isRetry) {
                    log(`retry deploy`);
                    isRetry = true;
                    return deployAsync();
                }

                // default, save file
                return pxt.commands.saveOnlyAsync(resp);
            });
    }
}

function pairBootloaderAsync(): Promise<void> {
    log(`pair bootloader`)
    return pairAsync();
}

function winrtDeployCoreAsync(r: pxtc.CompileResult, d: pxt.commands.DeployOptions): Promise<void> {
    log(`winrt deploy`)
    return hidDeployCoreAsync(r, d)
        .timeout(20000)
        .catch((e) => {
            return pxt.packetio.disconnectAsync()
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
    log('local deploy');
    core.infoNotification(lf("Uploading..."));
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

function winrtSaveAsync(resp: pxtc.CompileResult) {
    return pxt.winrt.saveOnlyAsync(resp)
        .then((saved) => {
            if (saved) {
                core.infoNotification(lf("file saved!"));
            }
        })
        .catch((e) => core.errorNotification(lf("saving file failed...")));
}

export function setExtensionResult(res: pxt.editor.ExtensionResult) {
    extensionResult = res;
    applyExtensionResult();
}

function applyExtensionResult() {
    const res = extensionResult;
    if (!res) return;

    if (res.mkPacketIOWrapper) {
        log(`extension mkPacketIOWrapper`)
        pxt.packetio.mkPacketIOWrapper = res.mkPacketIOWrapper;
    }
    if (res.deployAsync) {
        log(`extension deploy core async`);
        pxt.commands.deployCoreAsync = res.deployAsync;
    }
    if (res.saveOnlyAsync) {
        log(`extension save only async`);
        pxt.commands.saveOnlyAsync = res.saveOnlyAsync;
    }
    if (res.saveProjectAsync) {
        log(`extension save project async`);
        pxt.commands.saveProjectAsync = res.saveProjectAsync;
    }
    if (res.renderBrowserDownloadInstructions) {
        log(`extension upload renderBrowserDownloadInstructions`);
        pxt.commands.renderBrowserDownloadInstructions = res.renderBrowserDownloadInstructions;
    }
    if (res.renderUsbPairDialog) {
        log(`extension renderUsbPairDialog`)
        pxt.commands.renderUsbPairDialog = res.renderUsbPairDialog;
    }
    if (res.showUploadInstructionsAsync) {
        log(`extension upload instructions async`);
        pxt.commands.showUploadInstructionsAsync = res.showUploadInstructionsAsync;
    }
    if (res.patchCompileResultAsync) {
        log(`extension build patch`);
        pxt.commands.patchCompileResultAsync = res.patchCompileResultAsync;
    }
    if (res.blocklyPatch) {
        log(`extension blockly patch`);
        pxt.blocks.extensionBlocklyPatch = res.blocklyPatch;
    }
    if (res.webUsbPairDialogAsync) {
        log(`extension webusb pair dialog`);
        pxt.commands.webUsbPairDialogAsync = res.webUsbPairDialogAsync;
    }
    if (res.onTutorialCompleted) {
        log(`extension tutorial completed`);
        pxt.commands.onTutorialCompleted = res.onTutorialCompleted;
    }
}

export function init(): void {
    pxt.onAppTargetChanged = () => {
        log('app target changed')
        init()
    }
    pxt.packetio.mkPacketIOWrapper = pxt.HF2.mkPacketIOWrapper;

    // reset commands to browser
    pxt.commands.renderDisconnectDialog = undefined;
    pxt.commands.deployCoreAsync = browserDownloadDeployCoreAsync;
    pxt.commands.browserDownloadAsync = browserDownloadAsync;
    pxt.commands.saveOnlyAsync = browserDownloadDeployCoreAsync;
    pxt.commands.webUsbPairDialogAsync = webusb.webUsbPairDialogAsync;
    pxt.commands.showUploadInstructionsAsync = showUploadInstructionsAsync;
    pxt.packetio.mkPacketIOAsync = undefined;
    // used by CLI pxt.commands.deployFallbackAsync = undefined;

    // check if webUSB is available and usable
    if (pxt.appTarget?.compile?.isNative || pxt.appTarget?.compile?.hasHex) {
        if (pxt.usb.isAvailable() && pxt.appTarget?.compile?.webUSB) {
            log(`enabled webusb`);
            pxt.usb.setEnabled(true);
            pxt.packetio.mkPacketIOAsync = pxt.usb.mkPacketIOAsync;
        } else {
            log(`enabled hid bridge (webusb disabled)`);
            pxt.usb.setEnabled(false);
            pxt.packetio.mkPacketIOAsync = hidbridge.mkBridgeAsync;
        }
    }

    const forceBrowserDownload = /force(Hex)?(Browser)?Download/i.test(window.location.href);
    const webUSBSupported = pxt.usb.isEnabled && pxt.appTarget?.compile?.webUSB;
    if (forceBrowserDownload || pxt.appTarget?.serial?.noDeploy) {
        log(`deploy: force browser download`);
        // commands are ready
    } else if (isNativeHost()) {
        log(`deploy: webkit deploy/save`);
        pxt.commands.deployCoreAsync = nativeHostDeployCoreAsync;
        pxt.commands.saveOnlyAsync = nativeHostSaveCoreAsync;
    } else if (pxt.winrt.isWinRT()) { // windows app
        log(`deploy: winrt`)
        if (pxt.appTarget.serial && pxt.appTarget.serial.useHF2) {
            log(`winrt deploy`);
            pxt.winrt.initWinrtHid(() => pxt.packetio.initAsync(true).then(() => { }), () => pxt.packetio.disconnectAsync());
            pxt.packetio.mkPacketIOAsync = pxt.winrt.mkPacketIOAsync;
            pxt.commands.deployCoreAsync = winrtDeployCoreAsync;
        } else {
            // If we're not using HF2, then the target is using their own deploy logic in extension.ts, so don't use
            // the wrapper callbacks
            log(`winrt + custom deploy`);
            pxt.winrt.initWinrtHid(null, null);
            if (pxt.appTarget.serial && pxt.appTarget.serial.rawHID)
                pxt.packetio.mkPacketIOAsync = pxt.winrt.mkPacketIOAsync;
            pxt.commands.deployCoreAsync = pxt.winrt.driveDeployCoreAsync;
        }
        pxt.commands.browserDownloadAsync = pxt.winrt.browserDownloadAsync;
        pxt.commands.saveOnlyAsync = winrtSaveAsync;
    } else if (pxt.BrowserUtils.isPxtElectron()) {
        log(`deploy: electron`);
        pxt.commands.deployCoreAsync = electron.driveDeployAsync;
        pxt.commands.electronDeployAsync = electron.driveDeployAsync;
    } else if (webUSBSupported) {
        log(`deploy: webusb`);
        pxt.commands.deployCoreAsync = hidDeployCoreAsync;
        pxt.commands.renderDisconnectDialog = webusb.renderUnpairDialog;
    } else if (hidbridge.shouldUse()) {
        log(`deploy: hid`);
        pxt.commands.deployCoreAsync = hidDeployCoreAsync;
    } else if (pxt.BrowserUtils.isLocalHost() && Cloud.localToken) { // local node.js
        log(`deploy: localhost`);
        pxt.commands.deployCoreAsync = localhostDeployCoreAsync;
    } else { // in browser
        log(`deploy: browser only`);
        // commands are ready
    }

    applyExtensionResult();
}

export function maybeReconnectAsync(pairIfDeviceNotFound = false) {
    return pxt.packetio.initAsync()
        .then(wrapper => {
            if (!wrapper) return Promise.resolve();
            return wrapper.reconnectAsync()
                .catch(e => {
                    if (e.type == "devicenotfound")
                        return pairIfDeviceNotFound && pairAsync();
                    throw e;
                })
        });
}

export function pairAsync(): Promise<void> {
    pxt.tickEvent("cmds.pair")
    return pxt.commands.webUsbPairDialogAsync(pxt.usb.pairAsync, core.confirmAsync)
        .then(res => {
            if (res) return maybeReconnectAsync();
            else return core.infoNotification("Oops, no device was paired.")
        });
}

export function showDisconnectAsync(): Promise<void> {
    if (pxt.commands.renderDisconnectDialog) {
        const { header, jsx, helpUrl } = pxt.commands.renderDisconnectDialog();
        return core.dialogAsync({ header, jsx, helpUrl, hideCancel: true, hasCloseIcon: true });
    }
    return Promise.resolve();
}

export function disconnectAsync(): Promise<void> {
    return pxt.packetio.disconnectAsync();
}

function handlePacketIOApi(r: string) {
    const p = data.stripProtocol(r);
    switch (p) {
        case "active":
            return pxt.packetio.isActive();
        case "connected":
            return pxt.packetio.isConnected();
        case "connecting":
            return pxt.packetio.isConnecting();
        case "icon":
            return pxt.packetio.icon();
    }
    return false;
}
data.mountVirtualApi("packetio", {
    getSync: handlePacketIOApi
});
