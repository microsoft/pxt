import * as workspace from "./workspace";
import * as data from "./data";

type Header = pxt.workspace.Header;

function cover(cvs: HTMLCanvasElement, img: HTMLImageElement) {
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
}

function renderIcon(img: HTMLImageElement): string {
    let icon: string = null;
    if (img && img.width > 0 && img.height > 0) {
        const cvs = document.createElement("canvas") as HTMLCanvasElement;
        cvs.width = 305;
        cvs.height = 200;
        cover(cvs, img);
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
                    data.invalidateHeader("header", header);
                });
        });
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

function logoCanvasAsync(): Promise<HTMLCanvasElement> {
    return pxt.BrowserUtils.loadImageAsync(pxt.appTarget.appTheme.logo)
        .then(img => {
            const cvs = document.createElement("canvas") as HTMLCanvasElement;
            cvs.width = 160;
            cvs.height = 120;
            const ctx = cvs.getContext("2d");
            const accent = pxt.appTarget.appTheme.accentColor;
            if (accent) {
                ctx.fillStyle = accent
                ctx.fillRect(0, 0, cvs.width, cvs.height);
            }
            cover(cvs, img);
            return cvs;
        })
        .catch(() => defaultCanvasAsync());
}

export function encodeBlobAsync(title: string, dataURL: string, blob: Uint8Array) {
    // if screenshot failed, dataURL is empty
    return (dataURL ? pxt.BrowserUtils.loadCanvasAsync(dataURL) : logoCanvasAsync())
        .catch(() => logoCanvasAsync())
        .then(cvs => chromifyAsync(cvs, title))
        .then(canvas => {
            return pxt.Util.encodeBlobAsync(canvas, blob).toDataURL("image/png")
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

declare interface GIFOptions {
    repeat?: number;
    quality?: number;
    workers?: number;
    workerScript?: string;
    background?: string;
    width?: number;
    height?: number;
    transparent?: string;
    dither?: boolean;
    debug?: boolean;

    maxFrames?: number;
    maxLength?: number;

    scale?: number;
}

declare interface GIFFrameOptions {
    delay?: number;
}

declare class GIF {
    constructor(options: GIFOptions);

    running: boolean;
    on(ev: string, handler: any): void;
    render(): void;
    abort(): void;
    addFrame(img: ImageData, opts?: GIFFrameOptions): void;
    frames: any[];
    freeWorkers: Worker[];
}

export class GifEncoder {
    private gif: GIF;
    private time: number;
    private cancellationToken: pxt.Util.CancellationToken;
    private renderPromise: Promise<string>;
    private scale = 1;

    constructor(private options: GIFOptions) {
        this.cancellationToken = new pxt.Util.CancellationToken();
        if (!this.options.maxFrames)
            this.options.maxFrames = 64;
        if (options.scale)
            this.scale = options.scale
    }

    start() {
        pxt.debug(`gif: start encoder`)
        this.gif = new GIF(this.options);
        this.time = -1;
        this.cancellationToken = new pxt.Util.CancellationToken();
        this.cancellationToken.startOperation();
        this.renderPromise = undefined;
    }

    cancel() {
        pxt.debug(`gif: cancel`)
        if (this.cancellationToken.isCancelled()) return;
        this.cancellationToken.cancel();
        if (this.gif && this.gif.running) {
            try {
                this.gif.abort();
            } catch (e) { }
        }
        this.clean();
    }

    private clean() {
        if (this.gif && this.gif.freeWorkers) {
            this.gif.freeWorkers.forEach(w => w.terminate());
            this.gif.freeWorkers = [];
        }
        this.gif = undefined;
        this.time = -1;
    }

    addFrame(dataUri: ImageData, delay?: number): boolean {
        if (this.cancellationToken.isCancelled() || this.renderPromise)
            return false;
        const t = pxt.Util.now();
        if (this.time < 0)
            this.time = t;
        if (delay === undefined)
            delay = t - this.time;
        if (this.scale != 1) {
            dataUri = pxt.BrowserUtils.scaleImageData(dataUri, this.scale);
        }
        pxt.debug(`gif: frame ${delay}ms`);
        this.gif.addFrame(dataUri, { delay });
        this.time = t;

        return this.gif.frames.length > this.options.maxFrames;
    }

    renderAsync(): Promise<string> {
        if (this.cancellationToken.isCancelled()) return Promise.resolve(undefined);
        // keep trying to render until size is small enough
        const tryRenderGifAsync: () => Promise<string> = () => {
            return this.renderGifAsync()
                .then(imageUri => {
                    this.cancellationToken.throwIfCancelled();
                    // check if we've passed the max size for the blob length
                    if (this.options.maxLength && imageUri.length > this.options.maxLength) {
                        const nframes = Math.floor(this.gif.frames.length * this.options.maxLength / imageUri.length) - 1;
                        pxt.log(`gif: size too large (${(imageUri.length / 1000) | 0}kb) reducing frames to ${nframes}`);
                        if (nframes <= 0) {
                            pxt.log(`gif: simulator image too large, cannot have a single frame`);
                            return undefined;
                        }
                        // try rendering again
                        this.gif.frames = this.gif.frames.slice(0, nframes);
                        return tryRenderGifAsync();
                    }

                    // all done
                    pxt.log(`gif: rendered ${this.gif.frames.length} frames to ${(imageUri.length / 1000) | 0}kb`);
                    return imageUri;
                })
        };

        pxt.debug(`gif: render ${this.gif.frames.length} frames`)
        if (!this.renderPromise)
            this.renderPromise = tryRenderGifAsync()
                .finally(() => this.clean())
                .catch(e => {
                    pxt.debug(`rendering failed`)
                    pxt.debug(e);
                    return undefined;
                });
        return this.renderPromise;
    }

    private renderGifAsync(): Promise<string> {
        this.cancellationToken.throwIfCancelled();
        return new Promise<Blob>((resolve, reject) => {
            this.gif.on('finished', (blob: Blob) => {
                this.gif.running = false;
                resolve(blob);
            });
            this.gif.on('abort', () => {
                pxt.debug(`gif: abort`)
                resolve(undefined);
            });
            this.gif.render();
        }).then(blob => ts.pxtc.Util.blobReadAsDataURL(blob));
    }
}

export function loadGifEncoderAsync(): Promise<GifEncoder> {
    if (!pxt.webConfig.gifworkerjs)
        return Promise.resolve(undefined);

    const options: GIFOptions = {
        workers: 1,
        dither: false,
        workerScript: pxt.webConfig.gifworkerjs,
        quality: pxt.appTarget.appTheme.simGifQuality || 16,
        transparent: pxt.appTarget.appTheme.simGifTransparent,
        maxFrames: pxt.appTarget.appTheme.simGifMaxFrames || 64,
        maxLength: pxt.appTarget.appTheme.simScreenshotMaxUriLength || 300000,
        scale: 2
    };
    return pxt.BrowserUtils.loadScriptAsync("gifjs/gif.js")
        .then(() => new GifEncoder(options));
}