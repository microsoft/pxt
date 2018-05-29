namespace pxt.BrowserUtils {

    export function isIFrame(): boolean {
        try {
            return window && window.self !== window.top;
        } catch (e) {
            return true;
        }
    }

    export function hasNavigator(): boolean {
        return typeof navigator !== "undefined";
    }

    export function isWindows(): boolean {
        return hasNavigator() && /(Win32|Win64|WOW64)/i.test(navigator.platform);
    }

    export function isWindows10(): boolean {
        return hasNavigator() && /(Win32|Win64|WOW64)/i.test(navigator.platform) && /Windows NT 10/i.test(navigator.userAgent);
    }

    export function isMobile(): boolean {
        return hasNavigator() && /mobi/i.test(navigator.userAgent);
    }

    //MacIntel on modern Macs
    export function isMac(): boolean {
        return hasNavigator() && /Mac/i.test(navigator.platform);
    }

    //This is generally appears for Linux
    //Android *sometimes* returns this
    export function isLinux(): boolean {
        return !!navigator && /Linux/i.test(navigator.platform);
    }

    // Detects if we are running on ARM (Raspberry pi)
    export function isARM(): boolean {
        return hasNavigator() && /arm/i.test(navigator.platform);
    }

    // Detects if we are running inside the UWP runtime (Edge)
    export function isUwpEdge(): boolean {
        return typeof window !== "undefined" && !!(<any>window).Windows;
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
        return hasNavigator() && /Edge/i.test(navigator.userAgent);
    }

    //IE11 also lies about its user agent, but has Trident appear somewhere in
    //the user agent. Detecting the different between IE11 and Edge isn't
    //super-important because the UI is similar enough
    export function isIE(): boolean {
        return hasNavigator() && /Trident/i.test(navigator.userAgent);
    }

    //Edge and IE11 lie about being Chrome
    export function isChrome(): boolean {
        return !isEdge() && !isIE() && !!navigator && (/Chrome/i.test(navigator.userAgent) || /Chromium/i.test(navigator.userAgent));
    }

    //Chrome and Edge lie about being Safari
    export function isSafari(): boolean {
        //Could also check isMac but I don't want to risk excluding iOS
        //Checking for iPhone, iPod or iPad as well as Safari in order to detect home screen browsers on iOS
        return !isChrome() && !isEdge() && !!navigator && /(Safari|iPod|iPhone|iPad)/i.test(navigator.userAgent);
    }

    //Safari and WebKit lie about being Firefox
    export function isFirefox(): boolean {
        return !isSafari() && !!navigator && (/Firefox/i.test(navigator.userAgent) || /Seamonkey/i.test(navigator.userAgent));
    }

    //These days Opera's core is based on Chromium so we shouldn't distinguish between them too much
    export function isOpera(): boolean {
        return hasNavigator() && /Opera|OPR/i.test(navigator.userAgent);
    }

    //Midori *was* the default browser on Raspbian, however isn't any more
    export function isMidori(): boolean {
        return hasNavigator() && /Midori/i.test(navigator.userAgent);
    }

    //Epiphany (code name for GNOME Web) is the default browser on Raspberry Pi
    //Epiphany also lies about being Chrome, Safari, and Chromium
    export function isEpiphany(): boolean {
        return hasNavigator() && /Epiphany/i.test(navigator.userAgent);
    }

    export function isTouchEnabled(): boolean {
        return typeof window !== "undefined" &&
            ('ontouchstart' in window               // works on most browsers
                || navigator.maxTouchPoints > 0);       // works on IE10/11 and Surface);
    }

    export function hasPointerEvents(): boolean {
        return typeof window != "undefined" && !!(window as any).PointerEvent;
    }

    export function hasSaveAs(): boolean {
        return isEdge() || isIE() || isFirefox();
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
        if (!hasNavigator()) return null;
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
            // pinned web site have a different user agent
            // Mozilla/5.0 (iPhone; CPU iPhone OS 10_2_1 like Mac OS X) AppleWebKit/602.4.6 (KHTML, like Gecko) Mobile/14D27
            // Mozilla/5.0 (iPad; CPU OS 10_3_3 like Mac OS X) AppleWebKit/603.3.8 (KHTML, like Gecko) Mobile/14G60
            if (!matches)
                matches = /(iPod|iPhone|iPad); CPU .*?OS (\d+)/i.exec(navigator.userAgent);
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
        if (!matches || matches.length == 0) {
            return null;
        }
        return matches[matches.length - 1];
    }

    let hasLoggedBrowser = false

    export function isBrowserSupported(): boolean {
        if (!navigator) {
            return true; //All browsers define this, but we can't make any predictions if it isn't defined, so assume the best
        }

        // allow bots in general
        if (/bot|crawler|spider|crawling/i.test(navigator.userAgent))
            return true;

        // testing browser versions
        const versionString = browserVersion();
        const v = parseInt(versionString || "0")

        const isRecentChrome = isChrome() && v >= 38;
        const isRecentFirefox = isFirefox() && v >= 31;
        const isRecentEdge = isEdge();
        const isRecentSafari = isSafari() && v >= 9;
        const isRecentOpera = (isOpera() && isChrome()) && v >= 21;
        const isRecentIE = isIE() && v >= 11;
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

    export function devicePixelRatio(): number {
        if (typeof window === "undefined" || !window.screen) return 1;

        if (window.screen.systemXDPI !== undefined
            && window.screen.logicalXDPI !== undefined
            && window.screen.systemXDPI > window.screen.logicalXDPI) {
            return window.screen.systemXDPI / window.screen.logicalXDPI;
        }
        else if (window && window.devicePixelRatio !== undefined) {
            return window.devicePixelRatio;
        }
        return 1;
    }

    export function browserDownloadBinText(text: string, name: string, contentType: string = "application/octet-stream", userContextWindow?: Window, onError?: (err: any) => void): string {
        return browserDownloadBase64(ts.pxtc.encodeBase64(text), name, contentType, userContextWindow, onError)
    }

    export function browserDownloadText(text: string, name: string, contentType: string = "application/octet-stream", userContextWindow?: Window, onError?: (err: any) => void): string {
        return browserDownloadBase64(ts.pxtc.encodeBase64(Util.toUTF8(text)), name, contentType, userContextWindow, onError)
    }

    export function isBrowserDownloadInSameWindow(): boolean {
        const windowOpen = isMobile() && isSafari() && !/downloadWindowOpen=0/i.test(window.location.href);
        return windowOpen;
    }

    // for browsers that strictly require that a download gets initiated within a user click
    export function isBrowserDownloadWithinUserContext(): boolean {
        const versionString = browserVersion();
        const v = parseInt(versionString || "0")
        const r = (isMobile() && isSafari() && v >= 11) || /downloadUserContext=1/i.test(window.location.href);
        return r;
    }

    export function browserDownloadDataUri(uri: string, name: string, userContextWindow?: Window) {
        const windowOpen = isBrowserDownloadInSameWindow();
        const versionString = browserVersion();
        const v = parseInt(versionString || "0")
        if (windowOpen) {
            if (userContextWindow) userContextWindow.location.href = uri;
            else window.open(uri, "_self");
        } else if (pxt.BrowserUtils.isSafari()
            && (v < 10 || (versionString.indexOf('10.0') == 0) || isMobile())) {
            // For Safari versions prior to 10.1 and all Mobile Safari versions
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
        } else if (pxt.BrowserUtils.isEdge() || pxt.BrowserUtils.isIE()) {
            //Fix for edge
            let byteString = atob(uri.split(',')[1]);
            let ia = Util.stringToUint8Array(byteString);
            let blob = new Blob([ia], { type: "img/png" });
            window.navigator.msSaveOrOpenBlob(blob, name);
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

    export function browserDownloadUInt8Array(buf: Uint8Array, name: string, contentType: string = "application/octet-stream", userContextWindow?: Window, onError?: (err: any) => void): string {
        return browserDownloadBase64(ts.pxtc.encodeBase64(Util.uint8ArrayToString(buf)), name, contentType, userContextWindow, onError)
    }

    export function toDownloadDataUri(b64: string, contentType: string): string {
        let protocol = "data";
        if (isMobile() && isSafari() && pxt.appTarget.appTheme.mobileSafariDownloadProtocol)
            protocol = pxt.appTarget.appTheme.mobileSafariDownloadProtocol;
        const m = /downloadProtocol=([a-z0-9:/?]+)/i.exec(window.location.href);
        if (m) protocol = m[1];
        const dataurl = protocol + ":" + contentType + ";base64," + b64
        return dataurl;
    }

    export function browserDownloadBase64(b64: string, name: string, contentType: string = "application/octet-stream", userContextWindow?: Window, onError?: (err: any) => void): string {
        pxt.debug('trigger download')

        const saveBlob = (<any>window).navigator.msSaveOrOpenBlob && !pxt.BrowserUtils.isMobile();
        const dataurl = toDownloadDataUri(b64, name);
        try {
            if (saveBlob) {
                const b = new Blob([Util.stringToUint8Array(atob(b64))], { type: contentType })
                const result = (<any>window).navigator.msSaveOrOpenBlob(b, name);
            } else browserDownloadDataUri(dataurl, name, userContextWindow);
        } catch (e) {
            if (onError) onError(e);
            pxt.debug("saving failed")
        }
        return dataurl;
    }

    export function loadImageAsync(data: string): Promise<HTMLImageElement> {
        const img = document.createElement("img") as HTMLImageElement;
        return new Promise<HTMLImageElement>((resolve, reject) => {
            img.onload = () => resolve(img);
            img.onerror = () => resolve(undefined);
            img.crossOrigin = "anonymous";
            img.src = data;
        });
    }

    function resolveCdnUrl(path: string): string {
        // don't expand full urls
        if (/^https?:\/\//i.test(path))
            return path;
        const monacoPaths: Map<string> = (window as any).MonacoPaths || {};
        const blobPath = monacoPaths[path];
        // find compute blob url
        if (blobPath)
            return blobPath;
        // might have been exanded already
        if (U.startsWith(path, pxt.webConfig.commitCdnUrl))
            return path;
        // append CDN
        return pxt.webConfig.commitCdnUrl + path;
    }

    export function loadStyleAsync(path: string, rtl?: boolean): Promise<void> {
        if (rtl) path = "rtl" + path;
        const id = "style-" + path;
        if (document.getElementById(id)) return Promise.resolve();

        const url = resolveCdnUrl(path);
        const links = Util.toArray(document.head.getElementsByTagName("link"));
        const link = links.filter(l => l.getAttribute("href") == url)[0];
        if (link) {
            if (!link.id) link.id = id;
            return Promise.resolve();
        }

        return new Promise<void>((resolve, reject) => {
            const el = document.createElement("link");
            el.href = url;
            el.rel = "stylesheet";
            el.type = "text/css";
            el.id = id;
            el.addEventListener('load', () => resolve());
            el.addEventListener('error', (e) => reject(e));
            document.head.appendChild(el);
        });
    }

    export function loadScriptAsync(path: string): Promise<void> {
        const url = resolveCdnUrl(path);
        pxt.debug(`script: loading ${url}`);
        return new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = url;
            script.async = true;
            script.addEventListener('load', () => resolve());
            script.addEventListener('error', (e) => reject(e));
            document.body.appendChild(script);
        });
    }

    export function loadAjaxAsync(url: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            let httprequest = new XMLHttpRequest();
            httprequest.onreadystatechange = function () {
                if (httprequest.readyState == XMLHttpRequest.DONE) {
                    if (httprequest.status == 200) {
                        resolve(httprequest.responseText);
                    }
                    else {
                        reject(httprequest.status);
                    }
                }
            };
            httprequest.open("GET", url, true);
            httprequest.send();
        })
    }

    let loadBlocklyPromise: Promise<void>;
    export function loadBlocklyAsync(): Promise<void> {
        if (!loadBlocklyPromise) {
            pxt.debug(`blockly: delay load`);
            let p = pxt.BrowserUtils.loadStyleAsync("blockly.css", ts.pxtc.Util.isUserLanguageRtl());
            // js not loaded yet?
            if (typeof Blockly === "undefined")
                p = p.then(() => pxt.BrowserUtils.loadScriptAsync("pxtblockly.js"));
            p = p.then(() => {
                pxt.debug(`blockly: loaded`)
            });
            loadBlocklyPromise = p;
        }
        return loadBlocklyPromise;
    }

    export function patchCdn(url: string): string {
        if (!url || !pxt.getOnlineCdnUrl()) return url;
        return url.replace("@cdnUrl@", pxt.getOnlineCdnUrl());
    }

    export function initTheme() {
        const theme = pxt.appTarget.appTheme;
        if (theme) {
            if (theme.accentColor) {
                let style = document.createElement('style');
                style.type = 'text/css';
                style.appendChild(document.createTextNode(
                    `.ui.accent { color: ${theme.accentColor}; }
                .ui.inverted.menu .accent.active.item, .ui.inverted.accent.menu  { background-color: ${theme.accentColor}; }`));
                document.getElementsByTagName('head')[0].appendChild(style);
            }
        }
        // RTL languages
        if (Util.isUserLanguageRtl()) {
            pxt.debug("rtl layout");
            document.body.classList.add("rtl");
            document.body.style.direction = "rtl";

            // replace semantic.css with rtlsemantic.css
            const links = Util.toArray(document.head.getElementsByTagName("link"));
            const semanticLink = links.filter(l => Util.endsWith(l.getAttribute("href"), "semantic.css"))[0];
            if (semanticLink) {
                const semanticHref = semanticLink.getAttribute("data-rtl");
                if (semanticHref) {
                    pxt.debug(`swapping to ${semanticHref}`)
                    semanticLink.setAttribute("href", semanticHref);
                }
            }
            // replace blockly.css with rtlblockly.css if possible
            const blocklyLink = links.filter(l => Util.endsWith(l.getAttribute("href"), "blockly.css"))[0];
            if (blocklyLink) {
                const blocklyHref = blocklyLink.getAttribute("data-rtl");
                if (blocklyHref) {
                    pxt.debug(`swapping to ${blocklyHref}`)
                    blocklyLink.setAttribute("href", blocklyHref);
                    blocklyLink.removeAttribute("data-rtl");
                }
            }
        }

        const sim = pxt.appTarget.simulator;
        if (sim
            && sim.boardDefinition
            && sim.boardDefinition.visual) {
            let boardDef = sim.boardDefinition.visual as pxsim.BoardImageDefinition;
            if (boardDef.image) {
                boardDef.image = patchCdn(boardDef.image)
                if (boardDef.outlineImage) boardDef.outlineImage = patchCdn(boardDef.outlineImage)
            }
        }

        // patch icons in bundled packages
        Object.keys(pxt.appTarget.bundledpkgs).forEach(pkgid => {
            const res = pxt.appTarget.bundledpkgs[pkgid];
            // path config before storing
            const config = JSON.parse(res[pxt.CONFIG_NAME]) as pxt.PackageConfig;
            if (config.icon) config.icon = patchCdn(config.icon);
            res[pxt.CONFIG_NAME] = JSON.stringify(config, null, 4);
        })
    }

    /**
     * Utility method to change the hash.
     * Pass keepHistory to retain an entry of the change in the browser history.
     */
    export function changeHash(hash: string, keepHistory?: boolean) {
        if (hash.charAt(0) != '#') hash = '#' + hash;
        if (keepHistory) {
            window.location.hash = hash;
        } else {
            window.history.replaceState('', '', hash)
        }
    }
}
