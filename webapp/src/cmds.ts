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
        fn,
        pxt.appTarget.compile.hexMimeType,
        e => core.errorNotification(lf("saving file failed..."))
    );
    return showUploadInstructionsAsync(fn, url);
}

function showUploadInstructionsAsync(fn: string, url: string): Promise<void> {
    let boardName = pxt.appTarget.appTheme.boardName || "???";
    let boardDriveName = pxt.appTarget.compile.driveName || "???";
    return core.confirmAsync({
        header: lf("Move your code to the {0}...  ", boardName),
        htmlBody: `        
<div class="ui fluid vertical steps">
  <div class="step">
    <i class="violet plug icon"></i>
    <div class="content">
      <div class="title">${lf("Connect")}</div>
      <div class="description">${lf("Connect your {0} to your computer using the USB cable.", boardName)}</div>
    </div>
  </div>
  <div class="step">
    <i class="violet save icon"></i>
    <div class="content">
      <div class="title">${lf("Save")}</div>
      <div class="description">${lf("Save the <code>.hex</code> file to your computer.")}</div>
    </div>
  </div>
  <a href='${encodeURI(url)}' download='${Util.htmlEscape(fn)}' target='_blank' class="step">
    <i class="violet copy icon"></i>
    <div class="content">
      <div class="title">${lf("Copy")}</div>
      <div class="description">${lf("Move the saved <code>.hex</code> file to the <code>{0}</code> drive.", boardDriveName)}</div>
    </div>
  </a>
  <div class="step">
    <i class="yellow flash circle icon"></i>
    <div class="content">
      <div class="title">${lf("Almost done...")}</div>
      <div class="description">${lf("Wait till the yellow LED is done blinking.")}</div>
    </div>
  </div>
</div>
${pxtwinrt.isWindows() ? `
    <div class="ui info message">
        Tired of copying the .hex file?
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