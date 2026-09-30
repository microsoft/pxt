import { getLocaleRequest, LocaleParameter } from "./iframeUrl";

let localeParameter: LocaleParameter | undefined;
let requestedLocale: string | undefined;

export function getLocaleParameter() {
    return localeParameter;
}

export function getRequestedLocale() {
    return requestedLocale;
}

/** Initialize localization using the same selection semantics as the editor. */
export async function initializeLocalizationAsync(): Promise<void> {
    const href = window.location.href;
    const theme = pxt.appTarget.appTheme;
    const request = getLocaleRequest(href);
    const translationMode = /[&?]translate=1/.test(href) && !pxt.BrowserUtils.isIE();

    let language: string;
    let force = false;
    if (translationMode) {
        language = ts.pxtc.Util.TRANSLATION_LOCALE;
        force = true;
        localeParameter = "forcelang";
        requestedLocale = language;
        pxt.Util.enableLiveLocalizationUpdates();
    } else {
        const hashMatch = /(live)?(force)?lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(window.location.hash);
        if (hashMatch) pxt.BrowserUtils.changeHash(window.location.hash.replace(hashMatch[0], ""));

        language = request.language
            || pxt.BrowserUtils.getCookieLang()
            || theme.defaultLocale
            || (navigator as any).userLanguage
            || navigator.language;
        force = request.parameter === "forcelang";
        localeParameter = request.parameter;
        requestedLocale = request.language;

        const staticLanguage = /staticlang=1/i.test(href);
        const defaultLocale = theme.defaultLocale;
        const languageLowerCase = language?.toLocaleLowerCase();
        const localDevServe = pxt.BrowserUtils.isLocalHostDev()
            && (!languageLowerCase || (defaultLocale
                ? defaultLocale.toLocaleLowerCase() === languageLowerCase
                : languageLowerCase === "en" || languageLowerCase === "en-us"));
        const serveLocal = pxt.BrowserUtils.isPxtElectron() || localDevServe;
        const updatesDisabled = staticLanguage || serveLocal || theme.disableLiveTranslations;

        if (!updatesDisabled || request.live) {
            pxt.Util.enableLiveLocalizationUpdates();
        }
    }

    await pxt.Util.updateLocalizationAsync({
        targetId: pxt.appTarget.id,
        baseUrl: pxt.webConfig.commitCdnUrl,
        code: language,
        force,
        translationKind: ts.pxtc.Util.TranslationsKind.TutorialTool
    });

    if (pxt.Util.isLocaleEnabled(language)) {
        pxt.BrowserUtils.setCookieLang(language);
    }
}

export function localizeDocumentMetadata() {
    document.documentElement.lang = pxt.Util.userLanguage();
    document.title = pxt.Util.lf("MakeCode Tutorial Tool");
    document.querySelector('meta[name="description"]')?.setAttribute("content", pxt.Util.lf("MakeCode Tutorial Tool. Build markdown tutorials for MakeCode editors"));
}
