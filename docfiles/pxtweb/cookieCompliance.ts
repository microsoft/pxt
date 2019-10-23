/// <reference path="../../localtypings/mscc.d.ts" />
/// <reference path="../../pxtwinrt/winrtrefs.d.ts"/>

declare var process: any;

namespace pxt {
    type Map<T> = { [index: string]: T };

    interface CookieBannerInfo {
        /* Does the banner need to be shown? */
        IsConsentRequired: boolean;

        /* Name of the cookie, usually MSCC */
        CookieName: string;

        /* HTML for the banner to be embedded into the page */
        Markup: string;

        /* Scripts to be loaded in the page for the banner */
        Js: string[];

        /* CSS files to be loaded in the page for the banner*/
        Css: string[];

        /* The minimum date for which consent is considered valid (any consent given before this date does not count) */
        MinimumConsentDate: string;

        /* Error message from the server, if present */
        Error?: string;
    }

    interface HttpResponse {
        status: number;
        body: string;
    }

    interface Callback<T> {
        (err?: any, res?: T): void;
    }

    const eventBufferSizeLimit = 20;
    const queues: TelemetryQueue<any, any, any>[] = [];

    let analyticsLoaded = false;

    class TelemetryQueue<A, B, C> {
        private q: [A, B, C][] = [];
        constructor(private log: (a?: A, b?: B, c?: C) => void) {
            queues.push(this);
        }

        public track(a: A, b: B, c: C) {
            if (analyticsLoaded) {
                this.log(a, b, c);
            }
            else {
                this.q.push([a, b, c]);
                if (this.q.length > eventBufferSizeLimit) this.q.shift();
            }
        }

        public flush() {
            while (this.q.length) {
                const [a, b, c] = this.q.shift();
                this.log(a, b, c);
            }
        }
    }

    let eventLogger: TelemetryQueue<string, Map<string>, Map<number>>;
    let exceptionLogger: TelemetryQueue<any, string, Map<string>>;

    export function initAnalyticsAsync() {
        if (isNativeApp() || shouldHideCookieBanner()) {
            initializeAppInsightsInternal(true);
            return;
        }

        if (isSandboxMode()) {
            initializeAppInsightsInternal(false);
            return;
        }

        getCookieBannerAsync(document.domain, detectLocale(), (bannerErr, info) => {
            if (bannerErr || info.Error) {
                // Start app insights, just don't drop any cookies
                initializeAppInsightsInternal(false);
                return;
            }

            // Clear the cookies if the consent is too old, mscc won't do it automatically
            if (isConsentExpired(info.CookieName, info.MinimumConsentDate)) {
                const definitelyThePast = new Date(0).toUTCString();
                document.cookie = `ai_user=; expires=${definitelyThePast}`;
                document.cookie = `ai_session=; expires=${definitelyThePast}`;
                document.cookie = `${info.CookieName}=0; expires=${definitelyThePast}`;
            }

            let bannerDiv = document.getElementById("cookiebanner");
            if (!bannerDiv) {
                bannerDiv = document.createElement("div");
                document.body.insertBefore(bannerDiv, document.body.firstChild);
            }

            // The markup is trusted because it's from our backend, so it shouldn't need to be scrubbed
            /* tslint:disable:no-inner-html */
            bannerDiv.innerHTML = info.Markup;
            /* tslint:enable:no-inner-html */

            if (info.Css && info.Css.length) {
                info.Css.forEach(injectStylesheet)
            }

            all(info.Js || [], injectScriptAsync, msccError => {
                if (!msccError && typeof mscc !== "undefined") {
                    if (mscc.hasConsent()) {
                        initializeAppInsightsInternal(true)
                    }
                    else {
                        mscc.on("consent", () => initializeAppInsightsInternal(true));
                    }
                }
            });
        });
    }

    export function aiTrackEvent(id: string, data?: any, measures?: any) {
        if (!eventLogger) {
            eventLogger = new TelemetryQueue((a, b, c) => (window as any).appInsights.trackEvent(a, b, c));
        }
        eventLogger.track(id, data, measures);
    }

    export function aiTrackException(err: any, kind?: string, props?: any) {
        if (!exceptionLogger) {
            exceptionLogger = new TelemetryQueue((a, b, c) => (window as any).appInsights.trackException(a, b, c));
        }
        exceptionLogger.track(err, kind, props);
    }

    function detectLocale() {
        // Intentionally ignoring the default locale in the target settings and the language cookie
        // Warning: app.tsx overwrites the hash after reading the language so this needs
        // to be called before that happens
        const mlang = /(live)?lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(window.location.href);
        return mlang ? mlang[2] : ((navigator as any).userLanguage || navigator.language);
    }

    function getCookieBannerAsync(domain: string, locale: string, cb: Callback<CookieBannerInfo>) {
        httpGetAsync(`https://makecode.com/api/mscc/${domain}/${locale}`, function (err, resp) {
            if (err) {
                cb(err);
                return;
            }

            if (resp.status === 200) {
                try {
                    const info = JSON.parse(resp.body);
                    cb(undefined, info as CookieBannerInfo);
                    return;
                }
                catch (e) {
                    cb(new Error("Bad response from server: " + resp.body))
                    return;
                }
            }
            cb(new Error("didn't get 200 response: " + resp.status + " " + resp.body));
        });
    }

    function isConsentExpired(cookieName: string, minimumConsentDate: string) {
        const minDate = Date.parse(minimumConsentDate);

        if (!isNaN(minDate)) {
            if (document && document.cookie) {
                const cookies = document.cookie.split(";");
                for (let cookie of cookies) {
                    cookie = cookie.trim();
                    if (cookie.indexOf("=") == cookieName.length && cookie.substr(0, cookieName.length) == cookieName) {
                        const value = parseInt(cookie.substr(cookieName.length + 1));
                        if (!isNaN(value)) {
                            // The cookie value is the consent date in seconds since the epoch
                            return value < Math.floor(minDate / 1e3);
                        }
                        return true;
                    }
                }
            }
        }

        return true;
    }

    export function initializeAppInsightsInternal(includeCookie = false) {
        // loadAppInsights is defined in docfiles/tracking.html
        const loadAI = (window as any).loadAppInsights;
        if (loadAI) {
            loadAI(includeCookie);
            analyticsLoaded = true;
            queues.forEach(a => a.flush());
        }
    }

    function httpGetAsync(url: string, cb: Callback<HttpResponse>) {
        try {
            let client: XMLHttpRequest;
            let resolved = false
            client = new XMLHttpRequest();
            client.onreadystatechange = () => {
                if (resolved) return // Safari/iOS likes to call this thing more than once

                if (client.readyState == 4) {
                    resolved = true
                    let res: HttpResponse = {
                        status: client.status,
                        body: client.responseText
                    }
                    cb(undefined, res);
                }
            }

            client.open("GET", url);
            client.send();
        }
        catch (e) {
            cb(e);
        }
    }

    function injectStylesheet(href: string) {
        if (document.head) {
            const link = document.createElement("link");
            link.setAttribute("rel", "stylesheet");
            link.setAttribute("href", href);
            link.setAttribute("type", "text/css");
            document.head.appendChild(link);
        }
    }

    function injectScriptAsync(src: string, cb: Callback<void>) {
        let resolved = false;
        if (document.body) {
            const script = document.createElement("script");
            script.setAttribute("type", "text/javascript");
            script.onload = function (ev) {
                if (!resolved) {
                    cb();
                    resolved = true;
                }
            };
            script.onerror = function (err) {
                if (!resolved) {
                    cb(err);
                    resolved = true;
                }
            }
            document.body.appendChild(script);
            script.setAttribute("src", src);
        }
        else {
            throw new Error("Bad call to injectScriptAsync")
        }
    }

    /**
     * Checks for winrt, pxt-electron and Code Connection
     */
    function isNativeApp(): boolean {
        const hasWindow = typeof window !== "undefined";
        const isUwp = typeof Windows !== "undefined";
        const isPxtElectron = hasWindow && !!(window as any).pxtElectron;
        const isCC = hasWindow && !!(window as any).ipcRenderer || /ipc=1/.test(location.hash) || /ipc=1/.test(location.search); // In WKWebview, ipcRenderer is injected later, so use the URL query
        return isUwp || isPxtElectron || isCC;
    }
    /**
     * Checks whether we should hide the cookie banner
     */
    function shouldHideCookieBanner(): boolean {
        //We don't want a cookie notification when embedded in editor controllers, we'll use the url to determine that
        const noCookieBanner = isIFrame() && /nocookiebanner=1/i.test(window.location.href)
        return noCookieBanner;
    }
    function isIFrame(): boolean {
        try {
            return window && window.self !== window.top;
        } catch (e) {
            return false;
        }
    }
    /**
     * checks for sandbox
     */
    function isSandboxMode(): boolean {
        //This is restricted set from pxt.shell.isSandBoxMode and specific to share page
        //We don't want cookie notification in the share page
        const sandbox = /sandbox=1|#sandbox|#sandboxproject/i.test(window.location.href)
        return sandbox;
    }

    // No promises, so here we are
    function all<T, U>(values: T[], func: (value: T, innerCb: Callback<U>) => void, cb: Callback<U[]>) {
        let index = 0;
        let res: U[] = [];

        let doNext = () => {
            if (index >= values.length) {
                cb(undefined, res);
            }
            else {
                func(values[index++], (err, val) => {
                    if (err) {
                        cb(err);
                    }
                    else {
                        res.push(val);
                        doNext();
                    }
                });
            }
        };

        doNext();
    }
}