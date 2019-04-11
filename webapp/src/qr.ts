declare class QRCode {
    constructor(el: Element, options: any);
}

let loadPromise: Promise<boolean>;
function loadQrCodeJsAsync(): Promise<boolean> {
    if (!loadPromise)
        loadPromise = pxt.BrowserUtils.loadScriptAsync("qrcodejs/qrcode.min.js")
            .then(() => typeof QRCode !== "undefined")
            .catch(e => false)
    return loadPromise;
}

export function renderAsync(url: string): Promise<string> {
    const div = document.createElement("div");
    return loadQrCodeJsAsync()
        .then(loaded => {
            if (!loaded) return undefined;
            new QRCode(div, {
                text: url,
                width: 256,
                height: 256,
                colorDark: "#000000",
                colorLight: "#ffffff",
            })

            const canvas = div.firstElementChild as HTMLCanvasElement;
            return canvas.toDataURL("image/png");
        }).catch(e => {
            pxt.reportException(e);
            return undefined;
        })
}
