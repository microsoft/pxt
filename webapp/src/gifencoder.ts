
declare namespace gifshot {
    interface Result {
        error: any;
        image: any;
    }
    function createGIF(options: any, callback: (obj: Result) => void): void;
}

export interface GifEncoderOptions {
    gifWidth: number;
    gifHeight: number;
    sampleInterval?: number;
    images?: string[];
    frameDuration?: number;
}

export class GifEncoder {
    private time: number;
    private frames: {
        img: string;
        delay: number;
    }[];
    private cancellationToken: pxt.Util.CancellationToken;
    private renderPromise: Promise<string>;

    constructor(public options: GifEncoderOptions) {
        this.cancellationToken = new pxt.Util.CancellationToken();
    }

    start() {
        pxt.debug(`gif: start encoder`)
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
            this.renderPromise = this.resolveSizeAsync()
                .then(() => this.renderGifAsync())
                .catch(e => {
                    pxt.debug(`rendering failed`)
                    pxt.debug(e);
                    return undefined;
                });
        return this.renderPromise;
    }

    private resolveSizeAsync(): Promise<void> {
        // load first image
        if (!this.frames.length) return Promise.resolve();

        this.options.frameDuration = (this.frames.map(f => f.delay).reduce((p, c) => p + c, 0)
            / this.frames.length / 100) | 0;
        pxt.debug(`gif frame duration: ${this.options.frameDuration}`)
        return pxt.BrowserUtils.loadImageAsync(this.frames[0].img)
            .then(img => {
                this.options.gifWidth = img.width;
                this.options.gifHeight = img.height;
                pxt.debug(`gif size: ${this.options.gifWidth} x ${this.options.gifHeight}`)
            })
    }

    private renderGifAsync(): Promise<void> {
        this.cancellationToken.throwIfCancelled();

        return new Promise((resolve, reject) => {
            const opts = pxt.Util.clone(this.options);
            opts.images = this.frames.map(i => i.img);
            opts.frameDuration = 0.2;
            gifshot.createGIF(opts, (res) => {
                if (res.error) reject(res.error);
                else resolve(res.image);
            });
        })
    }
}

export function loadGifEncoderAsync(): Promise<GifEncoder> {
    return pxt.BrowserUtils.loadScriptAsync("gifshot.min.js")
        .then(() => new GifEncoder({
            gifWidth: 160,
            gifHeight: 120,
            sampleInterval: 4
        }));
}
