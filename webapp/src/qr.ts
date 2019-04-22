/// <reference path="../../localtypings/qrcode.d.ts" />

let loadPromise: Promise<boolean>;
function loadQrCodeGeneratorAsync(): Promise<boolean> {
    if (!loadPromise)
        loadPromise = pxt.BrowserUtils.loadScriptAsync("qrcode/qrcode.min.js")
            .then(() => typeof qrcode !== "undefined")
            .catch(e => false)
    return loadPromise;
}

export function renderAsync(url: string): Promise<string> {
    return loadQrCodeGeneratorAsync()
        .then(loaded => {
            if (!loaded) return undefined;
            const c = qrcode(0, 'L');
            let m = /^(https.*\/)([0-9-]+)$/.exec(url)
            if (m) {
                c.addData(m[1].toUpperCase(), 'Alphanumeric')
                //c.addData("HTTPS://PXT.IO/", 'Alphanumeric')
                c.addData(m[2].replace(/-/g, ""), 'Numeric')
            } else {
                m = /^(https.*\/)(_[a-zA-Z0-9]+)$/.exec(url)
                if (m) {
                    c.addData(m[1].toUpperCase(), 'Alphanumeric')
                    c.addData(m[2], 'Byte')
                } else {
                    c.addData(url, 'Byte')
                }
            }
            c.make()
            return c.createDataURL(5, 5)
        }).catch(e => {
            pxt.reportException(e);
            return undefined;
        })
}
