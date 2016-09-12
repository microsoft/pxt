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

enum MatchLevel
{
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
    console.log(`Search for image ${name} in ${pxt.appTarget.appTheme.usbHelp}`);
    if (!pxt.appTarget.appTheme.usbHelp) return null;
    let osMatch = (img: pxt.UsbHelpImage) => matchLevelForStrings(img.os, pxt.BrowserUtils.os());
    let browserMatch = (img: pxt.UsbHelpImage) => matchLevelForStrings(img.browser, pxt.BrowserUtils.browser());
    let matches = pxt.appTarget.appTheme.usbHelp.filter((img) => img.name == name && 
                                                                     osMatch(img) != MatchLevel.None && 
                                                                     browserMatch(img) != MatchLevel.None);
    console.log(`Matches = ${JSON.stringify(matches)}`);
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

    console.log(`Best match is ${matches[bestMatch]}`)

    return matches[bestMatch].path;
}

function showUploadInstructionsAsync(fn: string, url: string): Promise<void> {
    let boardName = pxt.appTarget.appTheme.boardName || "???";
    let boardDriveName = pxt.appTarget.compile.driveName || "???";
    let usbImagePath = namedUsbImage("connection");
    return core.confirmAsync({
        header: lf("Download your code to the {0}...", boardName),
        htmlBody: `        
<div class="ui styled fluid accordion">
  <div class="title active">
    <i class="dropdown icon"></i>
    ${lf("Connect your {0} to your computer using the USB cable.", boardName)}
  </div>
  <div class="content active">
    <div class="transition visible style="display:block !important;">
    ${usbImagePath ? `<img src="${usbImagePath}" alt="${lf("Connect your {0} to your computer using the USB cable.", boardName)}" style="max-height:250px;max-width:450px;margin:auto;display:block"/>`: ''}
    </div>
  </div>
  <div class="title">
    <i class="dropdown icon"></i>
    ${lf("Save the <code>.hex</code> file to your computer.")}
  </div>
  <div class="content">
    <p><a href="${encodeURI(url)}" target="_blank">${lf("Click here if the download hasn't started")}</a></p>
  </div>
  <div class="title">
    <i class="dropdown icon"></i>
    ${lf("Move the saved <code>.hex</code> file to the <code>{0}</code> drive.", boardDriveName)}
  </div>
  <div class="content">
  </div>
  <div class="title">
    <i class="dropdown icon"></i>
    ${lf("Wait till the yellow LED is done blinking.")}
  </div>
  <div class="content">
    <p>Does this need an explanation?</p>
  </div>
</div>
${pxt.BrowserUtils.isWindows() ? `
    <div class="ui info message landscape only">
        ${lf("Tired of copying the .hex file?")}
        <a href="/uploader" target="_blank">${lf("Install the Uploader!")}</a>
    </div>
    ` : ""}
<script type="text/javascript">$(".ui.accordion").accordion();</script>`, //This extra call needs to get fired otherwise the accordion isn't interactive
        hideCancel: true,
        agreeLbl: lf("Done!"),
        timeout: 5000
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