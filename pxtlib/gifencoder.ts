
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
}

declare class GIF {
    constructor(options: GIFOptions);

    on(ev: string, handler: any): void;
    render(): void;
    abort(): void;
    addFrame(img: HTMLImageElement, opts: any): void;
    static freeWorkers: any[];
}

namespace pxt.gif {
    export class GifEncoder {
        private gif: GIF;
        private time: number;
        private frames: {
            img: string;
            delay: number;
        }[];
        private cancellationToken: pxt.Util.CancellationToken;
        private renderPromise: Promise<string>;

        constructor(private options: GIFOptions) {
            this.cancellationToken = new pxt.Util.CancellationToken();
        }

        start() {
            pxt.debug(`gif: start encoder`)
            this.gif = new GIF(this.options);
            this.frames = [];
            this.time = 0;
            this.cancellationToken = new pxt.Util.CancellationToken();
            this.cancellationToken.startOperation();
            this.renderPromise = undefined;
        }

        cancel() {
            pxt.debug(`gif: cancel`)
            if (this.cancellationToken.isCancelled()) return;

            this.cancellationToken.cancel();
            if (this.gif) {
                try {
                    this.gif.abort();
                    if (GIF.freeWorkers)
                        GIF.freeWorkers.forEach(w => w.terminate());
                }
                catch (e) {
                    console.debug(e);
                }
            }
            this.gif = undefined;
            this.frames = undefined;
            this.time = 0;
        }

        addFrame(dataUri: string, time?: number): number {
            if (this.cancellationToken.isCancelled() || this.renderPromise) return 0;
            pxt.debug(`gif: add frame ${this.frames.length}`);

            const t = time | pxt.Util.now();
            const delay = this.frames.length ? t - this.time : 0;
            this.frames.push({
                img: dataUri,
                delay
            });
            this.time = t;

            return this.frames.length;
        }

        renderAsync(): Promise<string> {
            if (this.cancellationToken.isCancelled()) return Promise.resolve(undefined);

            pxt.debug(`gif: render`)
            if (!this.renderPromise)
                this.renderPromise = this.renderFramesAsync()
                    .then(() => this.renderGifAsync())
                    .then(blob => {
                        this.cancellationToken.throwIfCancelled();
                        this.gif = undefined;
                        this.frames = undefined;
                        return new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(<string>reader.result);
                            reader.onerror = e => reject(e);
                            reader.readAsDataURL(blob);
                        });
                    })
                    .catch(e => {
                        pxt.debug(`rendering failed`)
                        pxt.debug(e);
                        return undefined;
                    });
            return this.renderPromise;
        }

        private renderFramesAsync(): Promise<void> {
            this.cancellationToken.throwIfCancelled();

            const f = this.frames.shift();
            if (!f) return Promise.resolve();

            return pxt.BrowserUtils.loadImageAsync(f.img)
                .then(i => {
                    if (i)
                        this.gif.addFrame(i, { delay: f.delay });
                    return this.renderFramesAsync();
                });
        }

        private renderGifAsync(): Promise<Blob> {
            this.cancellationToken.throwIfCancelled();

            return new Promise((resolve, reject) => {
                this.gif.on('finished', (blob: Blob) => {
                    this.gif = undefined;
                    resolve(blob);
                });
                this.gif.on('abort', () => {
                    this.gif = undefined;
                    reject(undefined);
                });
                this.gif.render();
            })
        }
    }

    export function loadGifEncoderAsync(): Promise<GifEncoder> {
        const options: GIFOptions = {
            workers: 1,
            quality: 10,
            dither: false,
            workerScript: pxt.BrowserUtils.resolveCdnUrl("gif.worker.js")
        };
        return pxt.BrowserUtils.loadScriptAsync("gif.js")
            .then(() => new GifEncoder(options));
    }
}