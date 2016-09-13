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
    let sanitizedName = pkg.mainEditorPkg().header.name.replace(/[\\\/.?*^:<>|"\x00-\x1F ]/g, "-")
    let fn = pxt.appTarget.id + "-" + sanitizedName + ".hex"
    pxt.debug('saving ' + fn)
    let url = pxt.BrowserUtils.browserDownloadText(
        hex,
        fn,
        pxt.appTarget.compile.hexMimeType,
        e => core.errorNotification(lf("saving file failed..."))
    );

    let uploader = !!pxt.storage.getLocal("uploader");
    if (uploader) {
        core.infoNotification(lf("Save the .hex file to your Downloads folder and make sure the uploader is running."))
        return Promise.resolve();
    }
    else
        return showUploadInstructionsAsync(fn, url);
}

enum MatchLevel {
    None,
    Any,
    Exact
};

function matchLevelForStrings(haystack: string, needle: string): MatchLevel {
    if (haystack.indexOf(needle) !== -1) {
        return MatchLevel.Exact;
    }
    else if (haystack.indexOf("*") !== -1) {
        return MatchLevel.Any;
    }
    else {
        return MatchLevel.None
    }
}

//Searches the known USB image, matching on platform and browser
function namedUsbImage(name: string): string {
    if (!pxt.appTarget.appTheme.usbHelp) return null;
    let osMatch = (img: pxt.UsbHelpImage) => matchLevelForStrings(img.os, pxt.BrowserUtils.os());
    let browserMatch = (img: pxt.UsbHelpImage) => matchLevelForStrings(img.browser, pxt.BrowserUtils.browser());
    let matches = pxt.appTarget.appTheme.usbHelp.filter((img) => img.name == name &&
                                                                     osMatch(img) != MatchLevel.None &&
                                                                     browserMatch(img) != MatchLevel.None);
    if (matches.length == 0) return null;
    let bestMatch = 0;

    for (let i = 1; i < matches.length; i++) {
        //First we want to match on OS, then on browser
        if (osMatch(matches[i]) > osMatch(matches[bestMatch])) {
            bestMatch = i;
        }
        else if (browserMatch(matches[i]) > browserMatch(matches[bestMatch])) {
            bestMatch = i;
        }
    }

    return matches[bestMatch].path;
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
            title: lf("Connect your {0} to your computer using the USB cable.", boardName),
            image: "connection"
        },
        {
            title: lf("Save the <code>.hex</code> file to your computer."),
            body: `<a href="${encodeURI(url)}" target="_blank">${lf("Click here if the download hasn't started")}</a>`,
            image: "save"
        },
        {
            title: lf("Copy the <code>.hex</code> file to your {0} drive", boardDriveName),
            body: pxt.BrowserUtils.isMac() ? lf("Drag and drop the <code>.hex</code> file to your {0} drive in Finder", boardDriveName) :
                  pxt.BrowserUtils.isWindows() ? lf("Right click on the file in Windows Explorer, click 'Send To', and select {0}", boardDriveName) : "",
            image: "copy"
        }
    ];

    let usbImagePath = namedUsbImage("connection");
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
    ${step.image && namedUsbImage(step.image) ? `<img src="${namedUsbImage(step.image)}"  alt="${step.title}"  />` : ""}
</div>`).join('')}
</div>
${pxt.appTarget.appTheme.usbDocs ? `
    <div class="ui info message">
        <p><a href="${pxt.appTarget.appTheme.usbDocs}" target="_blank">${lf("For more information on how to transfer the program to your {0} click here", boardName)}</a></p>
    </div>` : ""}
${pxt.BrowserUtils.isWindows() ? `
    <div class="ui info message landscape only">
        ${lf("Tired of copying the .hex file?")}
        <a href="/uploader" target="_blank">${lf("Install the Uploader!")}</a>
    </div>
    ` : ""}
<script type="text/javascript">$(".ui.accordion").accordion();</script>`, //This extra call needs to get fired otherwise the accordion isn't interactive
        hideCancel: true,
        agreeLbl: lf("Done!"),
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
        data: resp
    }).then(r => { });
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