import * as workspace from "./workspace";
import * as data from "./data";

type Header = pxt.workspace.Header;

function renderIcon(img: HTMLImageElement): string {
    let icon: string = null;
    if (img && img.width > 0 && img.height > 0) {
        const cvs = document.createElement("canvas") as HTMLCanvasElement;
        cvs.width = 305;
        cvs.height = 200;
        let ox = 0;
        let oy = 0;
        let iw = 0;
        let ih = 0;
        if (img.height > img.width) {
            ox = 0;
            iw = img.width;
            ih = iw / cvs.width * cvs.height;
            oy = (img.height - ih) / 2;
        } else {
            oy = 0;
            ih = img.height;
            iw = ih / cvs.height * cvs.width;
            ox = (img.width - iw) / 2;
        }
        const ctx = cvs.getContext("2d");
        ctx.drawImage(img, ox, oy, iw, ih, 0, 0, cvs.width, cvs.height);
        icon = cvs.toDataURL('image/jpeg', 85);
    }
    return icon;
}

export function saveAsync(header: Header, screenshot: string): Promise<void> {
    return pxt.BrowserUtils.loadImageAsync(screenshot)
        .then(img => {
            const icon = renderIcon(img);
            return workspace.saveScreenshotAsync(header, screenshot, icon)
                .then(() => {
                    data.invalidate("header:" + header.id);
                    data.invalidate("header:*");
                });
        });
}

export function loadImageAsync(url: string) {
    return new Promise<HTMLCanvasElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas")
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext("2d")
            ctx.drawImage(img, 0, 0);
            resolve(canvas)
        };
    })
}

// randomly selected
const imageHeaderPref = [75, 15, 39, 177]

export function encodeBlobAsync(dataURL: string, blob: Uint8Array) {
    return loadImageAsync(dataURL)
        .then(canvas => {
            const neededBits = blob.length * 8
            // we take 6 bytes for the magic - 2 bits per channel, 6 bits per pixel - 8 pixels
            const magicPixels = 8
            const usableBytes = (canvas.width * canvas.height - magicPixels) * 3
            let bpp = 1
            while (bpp < 4) {
                if (usableBytes * bpp >= neededBits)
                    break
            }
            let addedLines = 0
            const addedLimit = canvas.width * canvas.height * 4
            if (usableBytes * bpp < neededBits) {
                const missing = neededBits - usableBytes * bpp
                const bitsPerLine = canvas.width * 3 * 8
                addedLines = Math.ceil(missing / bitsPerLine)
                const c2 = document.createElement("canvas")
                c2.width = canvas.width
                c2.height = canvas.height + addedLines
                const ctx = c2.getContext("2d")
                ctx.drawImage(canvas, 0, 0)
                canvas = c2
            }

            function encode(ptr: number, bpp: number, data: ArrayLike<number>) {
                for (let i = 0; i < data.length; ++i) {
                    
                }
            }

            const imageHeader = imageHeaderPref.concat([(addedLines >> 8) | (bpp << 6), addedLines & 0xff])

            const ctx = canvas.getContext("2d")
            const imgdat = ctx.getImageData(0, 0, canvas.width, canvas.height)
            let ptr = 0

            for ()


          })
}