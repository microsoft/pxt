/// <reference path="../typings/winrt/winrt.d.ts"/>

namespace pxt.BrowserUtils {
    export function isWindows(): boolean {
        return !!navigator && /Win32/i.test(navigator.platform);
    }

    export function isWinRT(): boolean {
        return typeof Windows !== "undefined";
    }

    export function browserDownloadText(text: string, name: string, contentType: string = "application/octet-stream", onError?: (err: any) => void): string {
        pxt.debug('trigger download')
        let buf = Util.stringToUint8Array(Util.toUTF8(text))
        return browserDownloadUInt8Array(buf, name, contentType, onError);
    }

    function browserDownloadUInt8Array(buf: Uint8Array, name: string, contentType: string = "application/octet-stream", onError?: (err: any) => void): string {
        const isMobileBrowser = /mobile/.test(navigator.userAgent);
        const isSafari = /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);
        const isDesktopIE = (<any>window).navigator.msSaveOrOpenBlob && !isMobileBrowser;

        const dataurl = "data:" + contentType + ";base64," + btoa(Util.uint8ArrayToString(buf))
        try {
            if (isDesktopIE) {
                let b = new Blob([buf], { type: contentType })
                let result = (<any>window).navigator.msSaveOrOpenBlob(b, name);
            } else if (isSafari) {
                // For mysterious reasons, the "link" trick closes the
                // PouchDB database                
                let iframe = document.getElementById("downloader") as HTMLIFrameElement;
                if (!iframe) {
                    pxt.debug('injecting downloader iframe')
                    iframe = document.createElement("iframe") as HTMLIFrameElement;
                    iframe.id = "downloader";
                    iframe.style.position = "absolute";
                    iframe.style.right = "0";
                    iframe.style.bottom = "0";
                    iframe.style.zIndex = "-1";
                    iframe.style.width = "1px";
                    iframe.style.height = "1px";
                    document.body.appendChild(iframe);
                }
                iframe.src = dataurl;
            } else {
                let link = <any>window.document.createElement('a');
                if (typeof link.download == "string") {
                    link.href = dataurl;
                    link.download = name;
                    document.body.appendChild(link); // for FF
                    link.click();
                    document.body.removeChild(link);
                } else {
                    document.location.href = dataurl;
                }
            }
        } catch (e) {
            if (onError) onError(e);
            pxt.debug("saving failed")
        }
        return dataurl;
    }

}