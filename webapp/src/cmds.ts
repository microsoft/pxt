/// <reference path="../../built/pxtlib.d.ts"/>
import * as core from "./core";
import * as electron from "./electron";
import * as pkg from "./package";
import * as hidbridge from "./hidbridge";
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
        return core.confirmAsync({
            header: lf("Compilation failed"),
            body: lf("Ooops, looks like there are errors in your program."),
            hideAgree: true,
            disagreeLbl: lf("Close")
        }).then(() => { });
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

function hidDeployCoreAsync(resp: pxtc.CompileResult, d?: pxt.commands.DeployOptions): Promise<void> {
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
            if (e.type === "devicenotfound" && d.reportDeviceNotFoundAsync && !!troubleshootDoc) {
                pxt.tickEvent("hid.flash.devicenotfound");
                return d.reportDeviceNotFoundAsync(troubleshootDoc, resp);
            } else {
                return pxt.commands.saveOnlyAsync(resp);
            }
        });
}

let askPairingCount = 0;
function askWebUSBPairAsync(resp: pxtc.CompileResult): Promise<void> {
    pxt.tickEvent(`webusb.askpair`);
    askPairingCount++;
    if (askPairingCount > 3) { // looks like this is not working, don't ask anymore
        pxt.tickEvent(`webusb.askpaircancel`);
        return browserDownloadDeployCoreAsync(resp);
    }

    const boardName = pxt.appTarget.appTheme.boardName || lf("device");
    return core.confirmAsync({
        header: lf("No device detected..."),
        htmlBody: `
<p><strong>${lf("Do you want to pair your {0} to the editor?", boardName)}</strong>
${lf("You will get instant downloads and data logging.")}</p>
<p class="ui font small">The pairing experience is a one-time process.</p>
        `,
    }).then(r => r ? showFirmwareUpdateInstructionsAsync(resp) : browserDownloadDeployCoreAsync(resp));
}

function showFirmwareUpdateInstructionsAsync(resp: pxtc.CompileResult): Promise<void> {
    return pxt.targetConfigAsync()
        .then(config => {
            const firmwareUrl = (config.firmwareUrls || {})[pxt.appTarget.simulator.boardDefinition.id];
            if (!firmwareUrl) // skip firmware update
                return showWebUSBPairingInstructionsAsync(resp)
            pxt.tickEvent(`webusb.upgradefirmware`);
            const boardName = pxt.appTarget.appTheme.boardName || lf("device");
            const driveName = pxt.appTarget.appTheme.driveDisplayName || "DRIVE";
            const htmlBody = `
    <div class="ui three column grid stackable">
        <div class="column">
            <div class="ui">
                <div class="content">
                    <div class="description">
                        <span class="ui yellow circular label">1</span>
                        <strong>${lf("Connect {0} to computer with USB cable", boardName)}</strong>
                        <br/>
                    </div>
                </div>
            </div>
        </div>
        <div class="column">
            <div class="ui">
                <div class="content">
                    <div class="description">
                        <span class="ui blue circular label">2</span>
                        <strong>${lf("Download the latest firmware")}</strong>
                        <br/>
                        <a href="${firmwareUrl}" target="_blank">${lf("Click here to update to latest firmware")}</a>
                    </div>
                </div>
            </div>
        </div>
        <div class="column">
            <div class="ui">
                <div class="content">
                    <div class="description">
                        <span class="ui blue circular label">3</span>
                        ${lf("Move the .uf2 file to your board")}
                        <br/>
                        ${lf("Locate the downloaded .uf2 file and drag it to the {0} drive", driveName)}
                    </div>
                </div>
            </div>
        </div>
    </div>`;
            return core.confirmAsync({
                header: lf("Upgrade firmware"),
                htmlBody,
                agreeLbl: lf("Upgraded!")
            })
                .then(r => r ? showWebUSBPairingInstructionsAsync(resp) : browserDownloadDeployCoreAsync(resp));
        });
}

function showWebUSBPairingInstructionsAsync(resp: pxtc.CompileResult): Promise<void> {
    pxt.tickEvent(`webusb.pair`);
    const boardName = pxt.appTarget.appTheme.boardName || lf("device");
    const htmlBody = `
    <div class="ui three column grid stackable">
        <div class="column">
            <div class="ui">
                <div class="content">
                    <div class="description">
                        <span class="ui yellow circular label">1</span>
                        <strong>${lf("Connect {0} to computer with USB cable", boardName)}</strong>
                        <br/>
                    </div>
                </div>
            </div>
        </div>
        <div class="column">
            <div class="ui">
                <div class="content">
                    <div class="description">
                        <span class="ui blue circular label">2</span>
                        ${lf("Select the device in the pairing dialog")}
                    </div>
                </div>
            </div>
        </div>
        <div class="column">
            <div class="ui">
                <div class="content">
                    <div class="description">
                        <span class="ui blue circular label">3</span>
                        ${lf("Press \"Connect\"")}
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    return core.confirmAsync({
        header: lf("Pair your {0}", boardName),
        agreeLbl: lf("Let's pair it!"),
        htmlBody,
    }).then(r => {
        pxt.usb.pairAsync()
            .then(() => {
                pxt.tickEvent(`webusb.pair.success`);
                return hidDeployCoreAsync(resp)
            })
            .catch(e => browserDownloadDeployCoreAsync(resp));
    })
}

function webUsbDeployCoreAsync(resp: pxtc.CompileResult): Promise<void> {
    pxt.tickEvent(`webusb.deploy`)
    return hidDeployCoreAsync(resp)
        .catch(e => askWebUSBPairAsync(resp));
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

export function initCommandsAsync(): Promise<void> {
    pxt.commands.browserDownloadAsync = browserDownloadAsync;
    pxt.commands.saveOnlyAsync = browserDownloadDeployCoreAsync;
    pxt.commands.showUploadInstructionsAsync = showUploadInstructionsAsync;
    const forceHexDownload = /forceHexDownload/i.test(window.location.href);

    if (pxt.usb.isAvailable() && (pxt.appTarget.compile.webUSB || /webusb=1/i.test(window.location.href))) {
        pxt.log(`enabled webusb`)
        pxt.usb.setEnabled(true)
        pxt.HF2.mkPacketIOAsync = pxt.usb.mkPacketIOAsync
    }

    if (isNativeHost()) {
        pxt.debug(`deploy/save using webkit host`);
        pxt.commands.deployCoreAsync = nativeHostDeployCoreAsync;
        pxt.commands.saveOnlyAsync = nativeHostSaveCoreAsync;
    } else if (pxt.usb.isEnabled && pxt.appTarget.compile.useUF2) {
        pxt.commands.deployCoreAsync = webUsbDeployCoreAsync;
    } else if (pxt.winrt.isWinRT()) { // windows app
        if (pxt.appTarget.serial && pxt.appTarget.serial.useHF2) {
            pxt.winrt.initWinrtHid(() => hidbridge.initAsync(true).then(() => { }), () => hidbridge.disconnectWrapperAsync());
            pxt.HF2.mkPacketIOAsync = pxt.winrt.mkPacketIOAsync;
            pxt.commands.deployCoreAsync = winrtDeployCoreAsync;
        } else {
            // If we're not using HF2, then the target is using their own deploy logic in extension.ts, so don't use
            // the wrapper callbacks
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
    } else if (electron.isPxtElectron) {
        pxt.commands.deployCoreAsync = electron.driveDeployAsync;
        pxt.commands.electronDeployAsync = electron.driveDeployAsync;
    } else if (hidbridge.shouldUse() && !pxt.appTarget.serial.noDeploy && !forceHexDownload) {
        pxt.commands.deployCoreAsync = hidDeployCoreAsync;
    } else if (Cloud.isLocalHost() && Cloud.localToken && !forceHexDownload) { // local node.js
        pxt.commands.deployCoreAsync = localhostDeployCoreAsync;
    } else { // in browser
        pxt.commands.deployCoreAsync = browserDownloadDeployCoreAsync;
    }

    return Promise.resolve();
}
