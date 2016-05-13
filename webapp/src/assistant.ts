import * as core from "./core"
import * as workspace from "./workspace"

export function shouldNag(id: string): boolean {
    let nag = JSON.parse(pxt.storage.getLocal("nag") || "{}");
    let r = !!nag[id];
    nag[id] = true;
    pxt.storage.setLocal("nag", JSON.stringify(nag));
    return r;
}

export function nagUploader() {
    if (!shouldNag('uploader') || !/windows/i.test(navigator.userAgent)) return;

    core.confirmAsync({
        header: lf("Tired of copying files to the micro:bit?"),
        hideCancel: true,
        htmlBody: `
        <img src="https://az820584.vo.msecnd.net/pub/xwbgsfcj" />
        <p>The uploader automatically copies your .hex file to all connected micro:bit boards.</p>
        <a target='_blank' class='ui button' href='/microbit-uploader.zip'>download</a>
        `
    }).done();
}