
namespace pxt.BrowserUtils {
    export function isWindows(): boolean {
        return !!navigator && /(Win32|Win64|WOW64)/i.test(navigator.platform);
    }

    //MacIntel on modern Macs
    export function isMac(): boolean {
        return !!navigator && /Mac/i.test(navigator.platform);
    }

    //This is generally appears for Linux
    //Android *sometimes* returns this
    export function isLinux(): boolean {
        return !!navigator && /Linux/i.test(navigator.platform);
    }

    // Detects if we are running on ARM (Raspberry pi)
    export function isARM(): boolean {
        return !!navigator && /arm/i.test(navigator.platform);
    }

    /*
    Notes on browser detection

    Actually:   Claims to be:
                IE  Edge    Chrome  Safari  Firefox
    IE          X                   X?
    Edge            X       X       X
    Chrome                  X       X
    Safari                          X       X
    Firefox                                 X

    I allow Opera to go about claiming to be Chrome because it might as well be
    */

    //Edge lies about its user agent and claims to be Chrome, but Edge/Version
    //is always at the end
    export function isEdge(): boolean {
        return !!navigator && /Edge/i.test(navigator.userAgent);
    }

    //IE11 also lies about its user agent, but has Trident appear somewhere in
    //the user agent. Detecting the different between IE11 and Edge isn't
    //super-important because the UI is similar enough
    export function isIE(): boolean {
        return !!navigator && /Trident/i.test(navigator.userAgent);
    }

    //Edge and IE11 lie about being Chrome
    export function isChrome(): boolean {
        return !isEdge() && !isIE() && !!navigator && (/Chrome/i.test(navigator.userAgent) || /Chromium/i.test(navigator.userAgent));
    }

    //Chrome and Edge lie about being Safari
    export function isSafari(): boolean {
        //Could also check isMac but I don't want to risk excluding iOS
        return !isChrome() && !isEdge() && !!navigator && /Safari/i.test(navigator.userAgent);
    }

    //Safari and WebKit lie about being Firefox
    export function isFirefox(): boolean {
        return !isSafari() && !!navigator && (/Firefox/i.test(navigator.userAgent) || /Seamonkey/i.test(navigator.userAgent));
    }

    //These days Opera's core is based on Chromium so we shouldn't distinguish between them too much
    export function isOpera(): boolean {
        return !!navigator && /Opera|OPR/i.test(navigator.userAgent);
    }

    export function os(): string {
        if (isWindows()) return "windows";
        else if (isMac()) return "mac";
        else if (isLinux()) return "linux";
        else return "unknown";
    }

    export function browser(): string {
        if (isEdge()) return "edge";
        else if (isOpera()) return "opera";
        else if (isIE()) return "ie";
        else if (isChrome()) return "chrome";
        else if (isSafari()) return "safari";
        else if (isFirefox()) return "firefox";
        else return "unknown";
    }

    export function isBrowserSupported(): boolean {
        return false;
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
