
namespace pxt.BrowserUtils {

    export function isIFrame(): boolean {
        try {
            return window && window.self !== window.top;
        } catch (e) {
            return true;
        }
    }

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

    //Midori *was* the default browser on Raspbian, however isn't any more
    export function isMidori(): boolean {
        return !!navigator && /Midori/i.test(navigator.userAgent);
    }

    //Epiphany (code name for GNOME Web) is the default browser on Raspberry Pi
    //Epiphany also lies about being Chrome, Safari, and Chromium
    export function isEpiphany(): boolean {
        return !!navigator && /Epiphany/i.test(navigator.userAgent);
    }

    export function os(): string {
        if (isWindows()) return "windows";
        else if (isMac()) return "mac";
        else if (isLinux() && isARM()) return "rpi";
        else if (isLinux()) return "linux";
        else return "unknown";
    }

    export function browser(): string {
        if (isEdge()) return "edge";
        if (isEpiphany()) return "epiphany";
        else if (isMidori()) return "midori";
        else if (isOpera()) return "opera";
        else if (isIE()) return "ie";
        else if (isChrome()) return "chrome";
        else if (isSafari()) return "safari";
        else if (isFirefox()) return "firefox";
        else return "unknown";
    }

    export function browserVersion(): string {
        if (!navigator) return null;
        //Unsurprisingly browsers also lie about this and include other browser versions...
        let matches: string[] = [];
        if (isOpera()) {
            matches = /(Opera|OPR)\/([0-9\.]+)/i.exec(navigator.userAgent);
        }
        if (isEpiphany()) {
            matches = /Epiphany\/([0-9\.]+)/i.exec(navigator.userAgent);
        }
        else if (isMidori()) {
            matches = /Midori\/([0-9\.]+)/i.exec(navigator.userAgent);
        }
        else if (isSafari()) {
            matches = /Version\/([0-9\.]+)/i.exec(navigator.userAgent);
        }
        else if (isChrome()) {
            matches = /(Chrome|Chromium)\/([0-9\.]+)/i.exec(navigator.userAgent);
        }
        else if (isEdge()) {
            matches = /Edge\/([0-9\.]+)/i.exec(navigator.userAgent);
        }
        else if (isIE()) {
            matches = /(MSIE |rv:)([0-9\.]+)/i.exec(navigator.userAgent);
        }
        else {
            matches = /(Firefox|Seamonkey)\/([0-9\.]+)/i.exec(navigator.userAgent);
        }
        if (matches.length == 0) {
            return null;
        }
        return matches[matches.length - 1];
    }

    let hasLoggedBrowser = false

    export function isBrowserSupported(): boolean {
        if (!navigator) {
            return true; //All browsers define this, but we can't make any predictions if it isn't defined, so assume the best
        }
        const versionString = browserVersion();
        const v = parseInt(versionString)

        const isRecentChrome = isChrome() && v >= 38
        const isRecentFirefox = isFirefox() && v >= 31
        const isRecentEdge = isEdge()
        const isRecentSafari = isSafari() && v >= 9
        const isRecentOpera = (isOpera() && isChrome()) && v >= 21
        const isRecentIE = isIE() && v >= 11
        const isModernBrowser = isRecentChrome || isRecentFirefox || isRecentEdge || isRecentSafari || isRecentOpera || isRecentIE

        //In the future this should check for the availability of features, such
        //as web workers
        let isSupported = isModernBrowser

        const isUnsupportedRPI = isMidori() || (isLinux() && isARM() && isEpiphany());
        const isNotSupported = isUnsupportedRPI;

        isSupported = isSupported && !isNotSupported

        //Bypass
        isSupported = isSupported || /anybrowser=(true|1)/.test(window.location.href)

        if (!hasLoggedBrowser) {
            pxt.log(`Browser: ${browser()} ${versionString} on ${os()}`)
            if (!isSupported) {
                pxt.tickEvent(`browser.unsupported.${navigator.userAgent}`)
            }
            hasLoggedBrowser = true
        }
        return isSupported
    }


    export function bestResourceForOsAndBrowser(resources: pxt.SpecializedResource[], name: string): pxt.SpecializedResource {
        if (resources === null || resources.length == 0) {
            return null;
        }

        enum MatchLevel {
            None,
            Any,
            Exact
        };

        function matchLevelForStrings(haystack: string, needle: string): MatchLevel {
            if (!haystack || !needle) {
                return MatchLevel.Any; //If either browser or OS isn't defined then we behave the same as *
            }
            if (haystack.indexOf(needle) !== -1) {
                return MatchLevel.Exact;
            }
            else if (haystack.indexOf("*") !== -1) {
                return MatchLevel.Any;
            }
            else {
                return MatchLevel.None
            }
        }

        let osMatch = (res: pxt.SpecializedResource) => matchLevelForStrings(res.os, os());
        let browserMatch = (res: pxt.SpecializedResource) => matchLevelForStrings(res.browser, browser());
        let matches = resources.filter((res) => res.name == name &&
            osMatch(res) != MatchLevel.None &&
            browserMatch(res) != MatchLevel.None);
        if (matches.length == 0) {
            return null;
        }
        let bestMatch = 0;

        for (let i = 1; i < matches.length; i++) {
            //First we want to match on OS, then on browser
            if (osMatch(matches[i]) > osMatch(matches[bestMatch])) {
                bestMatch = i;
            }
            else if (browserMatch(matches[i]) > browserMatch(matches[bestMatch])) {
                bestMatch = i;
            }
        }

        return matches[bestMatch];
    }

    export function suggestedBrowserPath(): string {
        let match = bestResourceForOsAndBrowser(pxt.appTarget.appTheme.browserSupport, "unsupported");
        return match ? match.path : null;
    }

    export function browserDownloadText(text: string, name: string, contentType: string = "application/octet-stream", onError?: (err: any) => void): string {
        pxt.debug('trigger download')
        let buf = Util.stringToUint8Array(Util.toUTF8(text))
        return browserDownloadUInt8Array(buf, name, contentType, onError);
    }

    export function browserDownloadDataUri(uri: string, name: string) {
        if (pxt.BrowserUtils.isSafari()) {
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
            iframe.src = uri;
        } else {
            let link = <any>window.document.createElement('a');
            if (typeof link.download == "string") {
                link.href = uri;
                link.download = name;
                document.body.appendChild(link); // for FF
                link.click();
                document.body.removeChild(link);
            } else {
                document.location.href = uri;
            }
        }
    }

    export function browserDownloadUInt8Array(buf: Uint8Array, name: string, contentType: string = "application/octet-stream", onError?: (err: any) => void): string {
        const isMobileBrowser = /mobile/.test(navigator.userAgent);
        const isDesktopIE = (<any>window).navigator.msSaveOrOpenBlob && !isMobileBrowser;

        const dataurl = "data:" + contentType + ";base64," + btoa(Util.uint8ArrayToString(buf))
        try {
            if (isDesktopIE) {
                let b = new Blob([buf], { type: contentType })
                let result = (<any>window).navigator.msSaveOrOpenBlob(b, name);
            } else browserDownloadDataUri(dataurl, name);
        } catch (e) {
            if (onError) onError(e);
            pxt.debug("saving failed")
        }
        return dataurl;
    }

}
