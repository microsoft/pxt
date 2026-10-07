export type LocaleParameter = "lang" | "forcelang";

export interface LocaleRequest {
    language?: string;
    parameter?: LocaleParameter;
    live: boolean;
}

export function getLocaleRequest(url: string): LocaleRequest {
    const match = /(live)?(force)?lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(url);
    return {
        language: match?.[3],
        parameter: match?.[2] ? "forcelang" : match ? "lang" : undefined,
        live: !!match?.[1]
    };
}

export function addLocaleToUrl(
    editorUrl: string,
    hostUrl: string,
    resolvedLanguage?: string,
    requestedParameter?: LocaleParameter
): string {
    const url = new URL(editorUrl, hostUrl);
    if (url.searchParams.has("forcelang") || url.searchParams.has("lang")) {
        return url.toString();
    }

    const requested = getLocaleRequest(hostUrl);
    if (requested.language) {
        url.searchParams.set(requested.parameter!, requested.language);
    } else if (resolvedLanguage && !/^en(?:-us)?$/i.test(resolvedLanguage)) {
        url.searchParams.set(requestedParameter || "lang", resolvedLanguage);
    }
    return url.toString();
}

export function createTutorialToolEditorUrl(
    editorUrl: string,
    hostUrl: string,
    resolvedLanguage?: string,
    requestedParameter?: LocaleParameter
): string {
    const url = new URL(editorUrl, hostUrl);

    // These values are required by the Tutorial Tool and match the base behavior.
    url.searchParams.set("controller", "1");
    url.searchParams.set("teachertool", "1");
    url.searchParams.set("ws", "mem");
    url.searchParams.set("nocookiebanner", "1");

    return addLocaleToUrl(url.toString(), hostUrl, resolvedLanguage, requestedParameter);
}
