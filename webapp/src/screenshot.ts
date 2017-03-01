import * as workspace from "./workspace";
import * as data from "./data";

type Header = pxt.workspace.Header;

const ICON_WIDTH = 305;
const ICON_HEIGHT = 200;
const ICON_MAX_FRAMES = 32;

function renderIcon(img: HTMLImageElement): string {
    let icon: string = null;
    if (img && img.width > 0 && img.height > 0) {
        const cvs = document.createElement("canvas") as HTMLCanvasElement;
        cvs.width = ICON_WIDTH;
        cvs.height = ICON_HEIGHT;
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

interface IGIF {
    addFrame(img: HTMLImageElement): void;
    on(ev: string, handler: (blob: Blob) => void): void;
    render(): void;
    frames: any[];
};

// https://github.com/jnordberg/gif.js
let recorder: IGIF = undefined; // GIF
let iconRecorder: IGIF = undefined; // GIF

function renderAsync(rec: IGIF, fn?: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        rec.on('finished', blob => {
            if (fn) {
                let ub = URL.createObjectURL(blob);
                pxt.BrowserUtils.browserDownloadDataUri(
                    ub,
                    fn);
                setTimeout(() => URL.revokeObjectURL(ub), 3000);
            }
            const fileReader = new FileReader();
            fileReader.onload = () => resolve(fileReader.result);
            fileReader.readAsDataURL(blob);
        });
        rec.render();
    });
}

export function addFrameAsync(uri: string): Promise<void> {
    if (!recorder) {
        recorder = new (window as any).GIF({
            workerScript: pxt.webConfig.pxtCdnUrl + "gifjs/gif.worker.js",
            workers: 1,
            repeat: 0
        });
        iconRecorder = new (window as any).GIF({
            workerScript: pxt.webConfig.pxtCdnUrl + "gifjs/gif.worker.js",
            workers: 1,
            repeat: 0,
        });
    }

    const rec = recorder;
    const irec = iconRecorder;
    return pxt.BrowserUtils.loadImageAsync(uri)
        .then((img) => {
            if (img) {
                rec.addFrame(img);
                if (irec.frames.length < ICON_MAX_FRAMES)
                    irec.addFrame(img);
            }
        });
}

export function stopRecording(header: Header, filename: string) {
    const rec = recorder;
    const irec = iconRecorder;
    recorder = undefined;
    iconRecorder = undefined;

    if (!rec || !irec) return;

    Promise.all([renderAsync(rec, filename), renderAsync(irec)])
        .done(urls => {
            if (!urls || urls.some(url => !url)) return;
            workspace.saveScreenshotAsync(header, urls[0], urls[1])
                .done(() => {
                    data.invalidate("header:" + header.id);
                    data.invalidate("header:*");
                });
        })
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
