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

function showUploadInstructionsAsync(fn: string, url: string): Promise<void> {
    let boardName = pxt.appTarget.appTheme.boardName || "???";
    let boardDriveName = pxt.appTarget.compile.driveName || "???";
    return core.confirmAsync({
        header: lf("Download your code to the {0}...", boardName),
        htmlBody: `        
<div class="ui fluid vertical steps">
  <div class="step">
    <div class="content">
      <div class="description">${lf("Connect your {0} to your computer using the USB cable.", boardName)}</div>
    </div>
  </div>
  <div class="step">
    <div class="content">
      <div class="description">${lf("Save the <code>.hex</code> file to your computer.")}</div>
    </div>
  </div>
  <a href='${encodeURI(url)}' download='${Util.htmlEscape(fn)}' target='_blank' class="step">
    <div class="content">
      <div class="description">${lf("Move the saved <code>.hex</code> file to the <code>{0}</code> drive.", boardDriveName)}</div>
    </div>
  </a>
  <div class="step">
    <div class="content">
      <div class="description">${lf("Wait till the yellow LED is done blinking.")}</div>
    </div>
  </div>
</div>
${pxtwinrt.isWindows() ? `
    <div class="ui info message landscape only">
        ${lf("Tired of copying the .hex file?")}
        <a href="/uploader" target="_blank">${lf("Install the Uploader!")}</a>
    </div>
    ` : ""}
`,
        hideCancel: true,
        agreeLbl: lf("Done!"),
        timeout: 5000
    }).then(() => { });
}

function localhostDeployCoreAsync(resp: pxtc.CompileResult): Promise<void> {
    pxt.debug('local deployment...');
    core.infoNotification(lf("Uploading .hex file..."));
    return Util.requestAsync({
        url: "http://localhost:3232/api/deploy",
        headers: { "Authorization": Cloud.localToken },
        method: "POST",
        data: resp
    }).then(r => { });
}

export function initCommandsAsync(): Promise<void> {
    if (pxtwinrt.isWinRT()) {
        pxt.debug('using winrt commands')
        pxt.commands.deployCoreAsync = (resp) => {
            core.infoNotification(lf("Uploading .hex file..."));
            return pxtwinrt.deployCoreAsync(resp)
                .then(() => {
                    core.infoNotification(lf(".hex file uploaded"));
                })
        }
        pxt.commands.browserDownloadAsync = pxtwinrt.browserDownloadAsync;
    } else if (Cloud.isLocalHost() && Cloud.localToken && !/forceHexDownload/i.test(window.location.href)) { // local node.js
        pxt.commands.deployCoreAsync = localhostDeployCoreAsync;
        pxt.commands.browserDownloadAsync = browserDownloadAsync;
    } else { // in browser
        pxt.commands.deployCoreAsync = browserDownloadDeployCoreAsync;
        pxt.commands.browserDownloadAsync = browserDownloadAsync;
    }

    return Promise.resolve();
}