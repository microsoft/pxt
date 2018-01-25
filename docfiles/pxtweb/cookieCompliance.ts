/// <reference path="../../localtypings/mscc.d.ts" />

namespace pxt {
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

    export function initAnalyticsAsync() {
        let bannerInfo: CookieBannerInfo;
        return getCookieBannerAsync(detectLocale(), document.domain)
            .then(info => info)
            .then(info => {
                if (info.Error) throw new Error("Error in cookie banner request: " + info.Error);

                bannerInfo = info;

                // Clear the cookie, mscc won't do it automatically
                if (isConsentExpired(info.CookieName, info.MinimumConsentDate)) {
                    document.cookie = `${info.CookieName}=0; expires=${new Date(0).toUTCString()}`;
                }

                let bannerDiv = document.getElementById("cookiebanner");
                if (!bannerDiv) {
                    bannerDiv = document.createElement("div");
                    document.body.insertBefore(bannerDiv, document.body.firstChild);
                }

                // The markup is trusted because it's from our backend, so it shouldn't need to be scrubbed
                bannerDiv.innerHTML = bannerInfo.Markup;

                if (info.Css && info.Css.length) {
                    info.Css.forEach(injectStylesheet)
                }

                if (info.Js && info.Js.length) {
                    return Promise.all(info.Js.map(injectScriptAsync)).then(() => {});
                }
                return Promise.resolve();
            })
            .then(() => {
                if (typeof mscc !== "undefined") {
                    if (mscc.hasConsent()) {
                        initializeAppInsights(true);
                        return;
                    }
                }
                initializeAppInsights(false);
            }, err => {
                // Better to be on the safe side
                initializeAppInsights(false);
            });
    }

    export function detectLocale() {
        // Intentionally ignoring the default locale in the target settings and the language cookie
        // Warning: app.tsx overwrites the hash after reading the language so this needs
        // to be called before that happens
        const mlang = /(live)?lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(window.location.href);
        return mlang ? mlang[2] : ((navigator as any).userLanguage || navigator.language);
    }

    function getCookieBannerAsync(domain: string, locale: string): Promise<CookieBannerInfo> {
        return httpGetAsync(`https://makecode.com/api/mscc/${domain}/${locale}`)
            .then(resp => {
                if (resp.status === 200) {
                    const info = JSON.parse(resp.body);
                    return info as CookieBannerInfo;
                }
                return Promise.reject(new Error(resp.body));
            })
    }

    function isConsentExpired(cookieName: string, minimumConsentDate: string) {
        const minDate = Date.parse(minimumConsentDate);

        if (!isNaN(minDate)) {
            if (document && document.cookie) {
                const cookies = document.cookie.split(";");
                for (const cookie of cookies) {
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

    function initializeAppInsights(includeCookie = false) {
        // loadAppInsights is defined in docfiles/tracking.html
        const loadAI = (window as any).loadAppInsights;
        if (loadAI) {
            loadAI(includeCookie)
        }
    }

    function httpGetAsync(url: string) {
        return new Promise<HttpResponse>((resolve, reject) => {
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
                    resolve(res)
                }
            }

            client.open("GET", url);
            client.send();
        })
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

    function injectScriptAsync(src: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (document.body) {
                const script = document.createElement("script");
                script.setAttribute("type", "text/javascript");
                script.onload = function (ev) {
                    resolve();
                };
                script.onerror = function (err) {
                    reject(err);
                }
                document.body.appendChild(script);
                script.setAttribute("src", src);
            }
        });
    }
}