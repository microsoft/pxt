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

function browserDownloadDeployCoreAsync(resp: ts.pxt.CompileResult): Promise<void> {
    let hex = resp.outfiles[ts.pxt.BINARY_HEX]
    let fn = pxt.appTarget.id + "-" + pkg.mainEditorPkg().header.name.replace(/[^a-zA-Z0-9]+/, "-") + ".hex"
    console.log('saving ' + fn)
    let url = pxt.BrowserUtils.browserDownloadText(
        hex,
        name,
        pxt.appTarget.compile.hexMimeType,
        e => core.errorNotification(lf("saving file failed..."))
    );
    return showUploadInstructionsAsync(fn, url);
}

function showUploadInstructionsAsync(fn: string, url: string): Promise<void> {
    let boardName = pxt.appTarget.appTheme.boardName || "???";
    let boardDriveName = pxt.appTarget.compile.driveName || "???";
    return core.confirmAsync({
        header: lf("Upload your code to the {0}...  ", boardName),
        htmlBody: `        
<div class="ui fluid vertical steps">
  <div class="step">
    <i class="violet plug icon"></i>
    <div class="content">
      <div class="title">${lf("Connect")}</div>
      <div class="description">${lf("Connect your {0} to your computer using the USB cable.", boardName)}</div>
    </div>
  </div>
  <a href='${encodeURI(url)}' download='${Util.htmlEscape(fn)}' target='_blank' class="step">
    <i class="violet copy icon"></i>
    <div class="content">
      <div class="title">${lf("Copy")}</div>
      <div class="description">${lf("Drag and drop <code>{0}</code> to the <code>{1}</code> drive.", fn, boardDriveName)}</div>
    </div>
  </a>
  <div class="step">
    <i class="yellow loading spinner icon"></i>
    <div class="content">
      <div class="title">${lf("Transfer")}</div>
      <div class="description">${lf("Wait till the yellow LED is done blinking.")}</div>
    </div>
  </div>
</div>
${pxtwinrt.isWindows() ? `
    <div>
        <em>Tired of copying the .hex file?</em>
        <a href="/uploader" target="_blank">Install the Uploader</a>!
    </div>
    ` : ""}
`,
        hideCancel: true,
        agreeLbl: lf("Done!")
    }).then(() => { });
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