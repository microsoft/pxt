import * as workspace from "./workspace";
type Header = pxt.workspace.Header;

function loadImageAsync(data: string): Promise<HTMLImageElement> {
    const img = document.createElement("img") as HTMLImageElement;
    return new Promise<HTMLImageElement>((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = () => resolve(undefined);
        img.src = data;
    });
}

function renderIcon(img: HTMLImageElement): string {
    let icon: string = null;
    if (img && img.width > 0 && img.height > 0) {
        const cvs = document.createElement("canvas") as HTMLCanvasElement;
        const w = 320;
        if (img.height > img.width) {
            cvs.width = w;
            cvs.height = img.width / w * img.height;
        } else {
            cvs.height = w;
            cvs.width = img.height / w * img.width;
        }
        const ctx = cvs.getContext("2d");
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, cvs.width, cvs.height);
        icon = cvs.toDataURL('image/png');
    }
    return icon;
}

export function saveAsync(header: Header, screenshot: string): Promise<void> {
    return loadImageAsync(screenshot)
        .then(img => {
            const icon = renderIcon(img);
            return workspace.saveScreenshotAsync(header, screenshot, icon)
        })
}
