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

const imageMagic = 0x59347a7d // randomly selected
const imageHeaderSize = 36 // has to be divisible by 9

export function decodeBlobAsync(dataURL: string) {
    return pxt.BrowserUtils.loadCanvasAsync(dataURL)
        .then(canvas => {
            const ctx = canvas.getContext("2d")
            const imgdat = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const d = imgdat.data
            const bpp = (d[0] & 1) | ((d[1] & 1) << 1) | ((d[2] & 1) << 2)
            if (bpp > 5)
                return Promise.reject(new Error(lf("Invalid encoded PNG format")))

            function decode(ptr: number, bpp: number, trg: Uint8Array) {
                let shift = 0
                let i = 0
                let acc = 0
                const mask = (1 << bpp) - 1
                while (i < trg.length) {
                    acc |= (d[ptr++] & mask) << shift
                    if ((ptr & 3) == 3)
                        ptr++ // skip alpha
                    shift += bpp
                    if (shift >= 8) {
                        trg[i++] = acc & 0xff
                        acc >>= 8
                        shift -= 8
                    }
                }
                return ptr
            }

            const hd = new Uint8Array(imageHeaderSize)
            let ptr = decode(4, bpp, hd)
            const dhd = pxt.HF2.decodeU32LE(hd)
            if (dhd[0] != imageMagic)
                return Promise.reject(new Error(lf("Invalid magic in encoded PNG")))
            const res = new Uint8Array(dhd[1])
            const addedLines = dhd[2]
            if (addedLines > 0) {
                const origSize = (canvas.height - addedLines) * canvas.width
                const imgCap = (origSize - 1) * 3 * bpp >> 3
                const tmp = new Uint8Array(imgCap - imageHeaderSize)
                decode(ptr, bpp, tmp)
                res.set(tmp)
                const added = new Uint8Array(res.length - tmp.length)
                decode(origSize * 4, 8, added)
                res.set(added, tmp.length)
            } else {
                decode(ptr, bpp, res)
            }
            return res
        })
}

function chromifyAsync(canvas: HTMLCanvasElement, title: string): HTMLCanvasElement {
    const w = canvas.width;
    const h = canvas.height;
    const work = document.createElement("canvas")
    const topBorder = 16;
    const bottomBorder = 16;
    const leftBorder = 16;
    const rightBorder = 16;
    const bottom = 32;
    work.width = w + leftBorder + rightBorder;
    work.height = h + topBorder + bottomBorder + bottom;
    const ctx = work.getContext("2d")
    ctx.imageSmoothingEnabled = false
    // white background
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, work.width, work.height)

    // draw image
    ctx.drawImage(canvas, leftBorder, topBorder);

    // header
    const header = pxt.appTarget.thumbnailName || pxt.appTarget.name;
    if (header) {
        const lblTop = 12
        ctx.fillStyle = 'black'
        ctx.font = '10px monospace'
        ctx.fillText(header, leftBorder, lblTop, w - leftBorder);
    }

    // title
    if (title) {
        const lblTop = topBorder + bottomBorder + h + 4;
        ctx.fillStyle = 'black'
        ctx.font = '13px monospace'
        ctx.fillText(title, leftBorder, lblTop, w - leftBorder);
    }

    // domain
    {
        const lblTop = topBorder + bottomBorder + h + 4 + 16
        ctx.fillStyle = '#444'
        ctx.font = '10px monospace'
        const url = pxt.appTarget.appTheme.homeUrl
            .replace(/^https:\/\//, '')
            .replace(/\/$/, '');
        ctx.fillText(url, leftBorder, lblTop, w);
    }

    return work;
}

function defaultCanvasAsync(): Promise<HTMLCanvasElement> {
    const cvs = document.createElement("canvas");
    cvs.width = 160;
    cvs.height = 120;
    const ctx = cvs.getContext("2d");
    ctx.fillStyle = '#33b';
    ctx.fillRect(0, 0, 160, 120);
    ctx.font = '30px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(':(', 60, 70);
    return Promise.resolve(cvs);
}

export function encodeBlobAsync(title: string, dataURL: string, blob: Uint8Array) {
    // if screenshot failed, dataURL is empty
    return (dataURL ? pxt.BrowserUtils.loadCanvasAsync(dataURL) : defaultCanvasAsync())
        .then(cvs => chromifyAsync(cvs, title))
        .then(canvas => {
            const neededBytes = imageHeaderSize + blob.length
            const usableBytes = (canvas.width * canvas.height - 1) * 3
            let bpp = 1
            while (bpp < 4) {
                if (usableBytes * bpp >= neededBytes * 8)
                    break
                bpp++
            }
            let imgCapacity = (usableBytes * bpp) >> 3
            let missing = neededBytes - imgCapacity
            let addedLines = 0
            let addedOffset = canvas.width * canvas.height * 4
            if (missing > 0) {
                const bytesPerLine = canvas.width * 3
                addedLines = Math.ceil(missing / bytesPerLine)
                const c2 = document.createElement("canvas")
                c2.width = canvas.width
                c2.height = canvas.height + addedLines
                const ctx = c2.getContext("2d")
                ctx.drawImage(canvas, 0, 0)
                canvas = c2
            }

            let header = pxt.HF2.encodeU32LE([
                imageMagic,
                blob.length,
                addedLines,
                0,
                0,
                0,
                0,
                0,
                0,
            ])

            pxt.Util.assert(header.length == imageHeaderSize)

            function encode(img: Uint8ClampedArray, ptr: number, bpp: number, data: ArrayLike<number>) {
                let shift = 0
                let dp = 0
                let v = data[dp++]
                const bppMask = (1 << bpp) - 1
                let keepGoing = true
                while (keepGoing) {
                    let bits = (v >> shift) & bppMask
                    let left = 8 - shift
                    if (left <= bpp) {
                        if (dp >= data.length) {
                            if (left == 0) break
                            else keepGoing = false
                        }
                        v = data[dp++]
                        bits |= (v << left) & bppMask
                        shift = bpp - left
                    } else {
                        shift += bpp
                    }
                    img[ptr] = ((img[ptr] & ~bppMask) | bits) & 0xff
                    ptr++
                    if ((ptr & 3) == 3) {
                        // set alpha to 0xff
                        img[ptr++] = 0xff
                    }
                }
                return ptr
            }

            const ctx = canvas.getContext("2d")
            const imgdat = ctx.getImageData(0, 0, canvas.width, canvas.height)

            // first pixel holds bpp (LSB are written first, so we can skip what it writes in second and third pixel)
            encode(imgdat.data, 0, 1, [bpp])
            let ptr = 4
            // next, the header
            ptr = encode(imgdat.data, ptr, bpp, header)
            pxt.Util.assert((ptr & 3) == 0)
            if (addedLines == 0)
                ptr = encode(imgdat.data, ptr, bpp, blob)
            else {
                let firstChunk = imgCapacity - header.length
                ptr = encode(imgdat.data, ptr, bpp, blob.slice(0, firstChunk))
                ptr = encode(imgdat.data, addedOffset, 8, blob.slice(firstChunk))
            }
            // set remaining alpha
            ptr |= 3
            while (ptr < imgdat.data.length) {
                imgdat.data[ptr] = 0xff
                ptr += 4
            }

            ctx.putImageData(imgdat, 0, 0)
            return canvas.toDataURL("image/png")
        })
}

/*
export function testBlobEncodeAsync(dataURL: string, sz = 10000) {
    let blob = new Uint8Array(sz)
    pxt.Util.getRandomBuf(blob)
    return encodeBlobAsync("test", dataURL, blob)
        .then(url => {
            let img = document.createElement("img")
            img.src = url
            document.getElementById("msg").appendChild(img)
            return decodeBlobAsync(url)
        })
        .then(resBlob => {
            pxt.Util.assert(resBlob.length == blob.length)
            for (let i = 0; i < blob.length; ++i) {
                pxt.Util.assert(resBlob[i] == blob[i])
            }
        })
}
*/