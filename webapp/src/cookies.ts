const pxtLangCookieId = "PXT_LANG";
const langCookieExpirationDays = 30;
let _consent: IConsent = undefined;

declare var mscc: any;

interface MsccConsentInfo {
    IsConsentRequired?: boolean;
    Markup?: string;
    Js?: string[];
}

interface IConsent {
    loadAsync(): Promise<void>;
    get(): boolean;
    set(): void;
}

enum CookieStatus {
    Unknown,
    Required,
    Consented
}

class MsccConsent implements IConsent {
    private _consentRequired = CookieStatus.Unknown;
    private _info: MsccConsentInfo;
    loadAsync(): Promise<void> {
        // check cookie
        // query service
        const theme = pxt.appTarget.appTheme;

        const domain = theme.homeUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '');
        const sitename = pxt.appTarget.id;
        const url = "https://uhf.microsoft.com/" + navigator.language + "/shell/api/mscc?sitename=" + encodeURIComponent(sitename) + "&domain=" + encodeURIComponent(domain) + "&mscc_eudomain=true";
        return pxt.Util.httpGetJsonAsync(url)
            .then((info: MsccConsentInfo) => {
                if (!info) return undefined;
                this._info = info;
                if (!info.IsConsentRequired) {
                    this._consentRequired = CookieStatus.Consented;
                    return Promise.resolve();
                }
                const jsUrl = this._info.Js[0];
                // delay load cookie library
                return pxt.BrowserUtils.loadScriptAsync(jsUrl)
                    .then(() => {
                        this._consentRequired = mscc.hasConsent() ? CookieStatus.Consented : CookieStatus.Required;
                    }, e => {
                        pxt.log("mscc: js unavailable");
                    })
            }, e => {
                pxt.log('mscc: service unavaiable');
                this._consentRequired = CookieStatus.Required;
            })
    }

    get(): boolean {
        return this._consentRequired !== CookieStatus.Required;
    }
    set(): void {
        this._consentRequired = CookieStatus.Consented;
        if (typeof mscc !== "undefined")
            mscc.setConsent();
    }
    msccAsync() {

    }
}

class LocalStorageConsent implements IConsent {
    private cookieKey = "cookieconsent";
    loadAsync(): Promise<void> {
        return Promise.resolve();
    }
    get(): boolean { return !!pxt.storage.getLocal(this.cookieKey); }
    set() {
        pxt.storage.setLocal(this.cookieKey, "1");
    }
}

export function loadAsync(): Promise<void> {
    _consent = pxt.appTarget.appTheme.msccCookieConsent ? new MsccConsent() : new LocalStorageConsent();
    return _consent.loadAsync();
}

export function hasConsent(): boolean { return _consent.get(); }
export function setConsent() { _consent.set(); }

export function cookieLang() {
    // essential cookie, no consent needed
    const cookiePropRegex = new RegExp(`${pxt.Util.escapeForRegex(pxtLangCookieId)}=(.*?)(?:;|$)`)
    const cookieValue = cookiePropRegex.exec(document.cookie);
    return cookieValue && cookieValue[1] || null;
}

export function setCookieLang(langId: string) {
    // essential cookie, no consent needed
    if (langId !== cookieLang()) {
        pxt.tickEvent(`menu.lang.setcookielang.${langId}`);
        const expiration = new Date();
        expiration.setTime(expiration.getTime() + (langCookieExpirationDays * 24 * 60 * 60 * 1000));
        document.cookie = `${pxtLangCookieId}=${langId}; expires=${expiration.toUTCString()}`;
    }
}
