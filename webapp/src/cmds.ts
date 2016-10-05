/// <reference path="../../built/pxtlib.d.ts"/>
import * as core from "./core";
import * as pkg from "./package";
import * as hwdbg from "./hwdbg";
import Cloud = pxt.Cloud;

function browserDownloadAsync(text: string, name: string, contentType: string): Promise<void> {
    let url = pxt.BrowserUtils.browserDownloadText(
        text,
        name,
        contentType,
        e => core.errorNotification(lf("saving file failed..."))
    );

    return Promise.resolve();
}

function browserDownloadDeployCoreAsync(resp: pxtc.CompileResult): Promise<void> {
    let hex = resp.outfiles[pxtc.BINARY_HEX]
    let fn = pkg.genFileName(".hex");
    pxt.debug('saving ' + fn)
    let url = pxt.BrowserUtils.browserDownloadText(
        hex,
        fn,
        pxt.appTarget.compile.hexMimeType,
        e => core.errorNotification(lf("saving file failed..."))
    );

    if (!resp.success) {
        return core.confirmAsync({
            header: lf("Compilation failed"),
            body: lf("Ooops, looks like there are errors in your program."),
            hideAgree: true,
            disagreeLbl: lf("Close")
        }).then(() => {});
    }

    let uploader = !!pxt.storage.getLocal("uploader");
    if (uploader) {
        core.infoNotification(lf("Save the .hex file to your Downloads folder and make sure the uploader is running."))
        return Promise.resolve();
    }
    else
        return showUploadInstructionsAsync(fn, url);
}

//Searches the known USB image, matching on platform and browser
function namedUsbImage(name: string): string {
    let match = pxt.BrowserUtils.bestResourceForOsAndBrowser(pxt.appTarget.appTheme.usbHelp, name);
    return match ? match.path : null;
}

interface UploadInstructionStep {
    title: string,
    body?: string,
    image?: string,
}

function showUploadInstructionsAsync(fn: string, url: string): Promise<void> {
    let boardName = pxt.appTarget.appTheme.boardName || "???";
    let boardDriveName = pxt.appTarget.compile.driveName || "???";

    let instructions: UploadInstructionStep[] = [
        {
            title: lf("Connect your {0} to your PC using the USB cable.", boardName),
            image: "connection"
        },
        {
            title: lf("Save the <code>.hex</code> file to your computer."),
            body: `<a href="${encodeURI(url)}" target="_blank">${lf("Click here if the download hasn't started.")}</a>`,
            image: "save"
        },
        {
            title: lf("Copy the <code>.hex</code> file to your {0} drive.", boardDriveName),
            body: pxt.BrowserUtils.isMac() ? lf("Drag and drop the <code>.hex</code> file to your {0} drive in Finder", boardDriveName) :
                pxt.BrowserUtils.isWindows() ? lf("Right click on the file in Windows Explorer, click 'Send To', and select {0}", boardDriveName) : "",
            image: "copy"
        }
    ];

    let usbImagePath = namedUsbImage("connection");
    let docUrl = pxt.appTarget.appTheme.usbDocs;
    return core.confirmAsync({
        header: lf("Download your code to the {0}...", boardName),
        htmlBody: `        
<div class="ui styled fluid accordion">
${instructions.map((step: UploadInstructionStep, i: number) =>
            `<div class="title ${i == 0 ? "active" : ""}">
  <i class="dropdown icon"></i>
  ${step.title}
</div>
<div class="content ${i == 0 ? "active" : ""}">
    ${step.body ? step.body : ""}
    ${step.image && namedUsbImage(step.image) ? `<img src="${namedUsbImage(step.image)}"  alt="${step.title}" class="ui centered large image" />` : ""}
</div>`).join('')}
</div>
${pxt.BrowserUtils.isWindows() ? `
    <div class="ui info message landscape desktop only">
        ${lf("Tired of copying the .hex file?")}
        <a href="/uploader" target="_blank">${lf("Install the Uploader!")}</a>
    </div>
    ` : ""}`,
        hideCancel: true,
        agreeLbl: lf("Done!"),
        buttons: !docUrl ? undefined : [{
            label: lf("Help"),
            icon: "help",
            class: "lightgrey",
            url: docUrl
        }],
        timeout: 0 //We don't want this to timeout now that it is interactive
    }).then(() => { });
}

function localhostDeployCoreAsync(resp: pxtc.CompileResult): Promise<void> {
    pxt.debug('local deployment...');
    core.infoNotification(lf("Uploading .hex file..."));
    let deploy = () => Util.requestAsync({
        url: "http://localhost:3232/api/deploy",
        headers: { "Authorization": Cloud.localToken },
        method: "POST",
        data: resp,
        allowHttpErrors: true
    }).then(r => {
        if (r.statusCode == 404) {
            core.errorNotification(lf("Please connect your {0} to your computer and try again", pxt.appTarget.appTheme.boardName));
        } else if (r.statusCode !== 200) {
            core.errorNotification(lf("There was a problem, please try again"));
        }
    });

    if (/quickflash/i.test(window.location.href))
        return hwdbg.partialFlashAsync(resp, deploy)
    else
        return deploy()
}

export function initCommandsAsync(): Promise<void> {
    if (Cloud.isLocalHost() && Cloud.localToken && !/forceHexDownload/i.test(window.location.href)) { // local node.js
        pxt.commands.deployCoreAsync = localhostDeployCoreAsync;
        pxt.commands.browserDownloadAsync = browserDownloadAsync;
    } else { // in browser
        pxt.commands.deployCoreAsync = browserDownloadDeployCoreAsync;
        pxt.commands.browserDownloadAsync = browserDownloadAsync;
    }

    return Promise.resolve();
}
