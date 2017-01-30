/// <reference path="../../built/pxtlib.d.ts"/>
import * as core from "./core";
import * as pkg from "./package";
import * as hwdbg from "./hwdbg";
import * as hidbridge from "./hidbridge";
import Cloud = pxt.Cloud;

let ModulationController: any = require("./ltc/modulate-controller.js");
let mod_controller: any = null;
let is_ltc: boolean = false;

function browserDownloadAsync(text: string, name: string, contentType: string): Promise<void> {
    let url = pxt.BrowserUtils.browserDownloadBinText(
        text,
        name,
        contentType,
        e => core.errorNotification(lf("saving file failed..."))
    );

    return Promise.resolve();
}

export function browserDownloadDeployCoreAsync(resp: pxtc.CompileResult): Promise<void> {
    let url = ""
    let fn = ""
    if (pxt.appTarget.compile.useUF2) {
        let uf2 = resp.outfiles[pxtc.BINARY_UF2]
        fn = pkg.genFileName(".uf2");
        pxt.debug('saving ' + fn)
        url = pxt.BrowserUtils.browserDownloadBase64(
            uf2,
            fn,
            "application/x-uf2",
            e => core.errorNotification(lf("saving file failed..."))
        );
    } else {
        let hex = resp.outfiles[pxtc.BINARY_HEX]
        fn = pkg.genFileName(".hex");
        pxt.debug('saving ' + fn)
        url = pxt.BrowserUtils.browserDownloadBinText(
            hex,
            fn,
            pxt.appTarget.compile.hexMimeType,
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

    if (resp.saveOnly) return Promise.resolve();
    else return showUploadInstructionsAsync(fn, url);
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
            `<div class="title">
  <i class="dropdown icon"></i>
  ${step.title}
</div>
<div class="content">
    ${step.body ? step.body : ""}
    ${step.image && namedUsbImage(step.image) ? `<img src="${namedUsbImage(step.image)}"  alt="${step.title}" class="ui centered large image" />` : ""}
</div>`).join('')}
</div>`,
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

function ltcIhexToBinary(ihex: string): Uint8Array {
    let hex = ihex.split("\n");
    let hexOutput: string[] = [];

    for (let i = 0; i < hex.length; ++i) {
        let m = /^:10(....)00(.{16})/.exec(hex[i]);
        if (!m) {
            m = /^:0C(....)00(.{12})/.exec(hex[i]);
            if (!m) {
                m = /^:08(....)00(.{8})/.exec(hex[i]);
                if (!m) {
                    m = /^:04(....)00(.{4})/.exec(hex[i]);
                    if (!m)
                        continue;
                }
            }
        }
        // Skip past the :, count, address, and record type fields, and chop off the checksum
        let s = hex[i].slice(9, hex[i].length - 2);
        let step = 2;
        while (s.length >= step) {
            let hexb = s.slice(0, step);
            hexOutput.push(hexb);
            s = s.slice(step)
        }
    }

    let output = new Uint8Array(hexOutput.length);
    for (let i = 0; i < hexOutput.length; i++) {
        output[i] = parseInt(hexOutput[i], 16);
    }
    return output;
}

function ltcRenderWave(e: any) {
    var aud = e.target;
    var current =  aud.currentTime;
    var end = aud.duration;
    var canvas = ltcGetAudioCanvas();

    if (!canvas || !canvas.getContext || !mod_controller || !end)
        return;

    var strip = canvas.getContext('2d');

    // Resize the canvas to be the window size.
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    var h = strip.canvas.height;
    var w = strip.canvas.width;
    strip.clearRect(0, 0, w, h);

    var y: number;
    // Draw scale lines at 10% interval
    strip.lineWidth = 1.0;
    strip.strokeStyle = "#55a";
    strip.beginPath();
    y = 1 * (h / 10);
    strip.moveTo(0, y);
    strip.lineTo(w, y);
    y = 2 * (h / 10);
    strip.moveTo(0, y);
    strip.lineTo(w, y);
    y = 3 * (h / 10);
    strip.moveTo(0, y);
    strip.lineTo(w, y);
    y = 4 * (h / 10);
    strip.moveTo(0, y);
    strip.lineTo(w, y);
    y = 5 * (h / 10);
    strip.moveTo(0, y);
    strip.lineTo(w, y);
    y = 6 * (h / 10);
    strip.moveTo(0, y);
    strip.lineTo(w, y);
    y = 7 * (h / 10);
    strip.moveTo(0, y);
    strip.lineTo(w, y);
    y = 8 * (h / 10);
    strip.moveTo(0, y);
    strip.lineTo(w, y);
    y = 9 * (h / 10);
    strip.moveTo(0, y);
    strip.lineTo(w, y);
    strip.stroke();

    strip.strokeStyle = "#fff";
    strip.lineWidth = 1.0;

    var buffer = mod_controller.getPcmData();
    var b = Math.floor(buffer.length * ((current * 1.0) / end));
    var lastSample = (buffer[b++] + 32768) / 65536.0; // map -32768..32768 to 0..1

    for (var x = 1; x < canvas.width; x++) {
        var sample = (buffer[b++] + 32768) / 65536.0;
        if (b > buffer.length)
            break;
        strip.beginPath();
        strip.moveTo(x - 1, h - lastSample * h);
        strip.lineTo(x, h - sample * h);
        strip.stroke();
        lastSample = sample;
    }
}

function ltcDeployCoreAsync(resp: pxtc.CompileResult): Promise<void> {
    pxt.debug('LTC deployment...');
    core.infoNotification(lf("Playing that sweet music..."));
    let bin = ltcIhexToBinary(resp.outfiles[pxtc.BINARY_HEX]);
    let audio = ltcGetAudioElement();

    if (mod_controller)
        mod_controller.stop();
    mod_controller = new ModulationController({
        canvas: ltcGetAudioCanvas(),
        endCallback: function() {
            ltcGetWaveFooter().style.display = 'none';
        }
    });

    audio.ontimeupdate = ltcRenderWave;
    mod_controller.transcodeToAudioTag(bin, audio, 'wav');

    ltcGetWaveFooter().style.display = 'block';

    return Promise.resolve();
}

function ltcGetAudioElement(): HTMLAudioElement {
    let audio = <HTMLAudioElement>document.getElementById("ltc_audio_output");
    if (audio)
        return audio;

    let audioDiv = <HTMLElement>document.createElement("div");
    audioDiv.className = "column left aligned";

    audio = document.createElement("audio");
    audio.id = "ltc_audio_output";
    audio.controls = true;

    audioDiv.appendChild(audio);
    document.getElementById("downloadArea").insertAdjacentElement("afterEnd", audioDiv);
    return audio;
}

function ltcGetWaveFooter(): HTMLDivElement {
    let footer = <HTMLDivElement>document.getElementById("ltc_audio_footer");
    if (footer)
        return footer;

    footer = document.createElement("div");
    footer.id = "ltc_audio_footer";
    footer.style.backgroundColor = "orange";
    footer.style.padding = "0";
    footer.style.margin = "0";
    footer.style.position = "fixed";
    footer.style.zIndex = "500";
    footer.style.width = "100";
    footer.style.left = "0";
    footer.style.bottom = "0";
    footer.style.display = "none";

    let canvas = document.createElement("canvas");
    canvas.id = "ltc_audio_canvas";
    canvas.style.border = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100px";
    canvas.style.margin = "0";
    canvas.style.padding = "0";
    footer.appendChild(canvas);

    document.getElementById("root").appendChild(footer);
    return footer;
}

function ltcGetAudioCanvas(): HTMLCanvasElement {
    let canvas = <HTMLCanvasElement>document.getElementById("ltc_audio_canvas");
    if (canvas)
        return canvas;

    ltcGetWaveFooter();
    return <HTMLCanvasElement>document.getElementById("ltc_audio_canvas");
}

export function isLtc(): boolean {
    return is_ltc;
}

export function ltcDeploySetup() {
    if (document.getElementById("ltc_audio_output"))
        return;

    // Play silence, in order to unblock audio.
    var audioTag = ltcGetAudioElement();
    audioTag.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
    audioTag.play();
    is_ltc = true;
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

    if (/quickflash/i.test(window.location.href))
        return hwdbg.partialFlashAsync(resp, deploy)
    else
        return deploy()
}

export function initCommandsAsync(): Promise<void> {
    pxt.commands.browserDownloadAsync = browserDownloadAsync;
    const forceHexDownload = /forceHexDownload/i.test(window.location.href);
    if (/webusb=1/i.test(window.location.href) && pxt.appTarget.compile.useUF2) {
        pxt.commands.deployCoreAsync = webusbDeployCoreAsync;
    } else if (1) {
        pxt.commands.deployCoreAsync = ltcDeployCoreAsync;
    } else if (hidbridge.shouldUse() && !forceHexDownload) {
        pxt.commands.deployCoreAsync = hidDeployCoreAsync;
    } else if (pxt.winrt.isWinRT()) { // window app
        pxt.commands.deployCoreAsync = pxt.winrt.deployCoreAsync;
        pxt.commands.browserDownloadAsync = pxt.winrt.browserDownloadAsync;
    } else if (Cloud.isLocalHost() && Cloud.localToken && !forceHexDownload) { // local node.js
        pxt.commands.deployCoreAsync = localhostDeployCoreAsync;
    } else { // in browser
        pxt.commands.deployCoreAsync = browserDownloadDeployCoreAsync;
    }

    return Promise.resolve();
}
