export type LocaleParameter = "lang" | "forcelang";

export interface LocaleRequest {
    language?: string;
    parameter?: LocaleParameter;
    live: boolean;
}

export function getLocaleRequest(url: string): LocaleRequest {
    const parsed = new URL(url, "https://makecode.com");
    return getLocaleRequestFromParams(parsed.searchParams)
        || getLocaleRequestFromParams(new URLSearchParams(parsed.hash.slice(1)))
        || { live: false };
}

function getLocaleRequestFromParams(params: URLSearchParams): LocaleRequest | undefined {
    for (const [parameter, live] of [["liveforcelang", true], ["forcelang", false], ["livelang", true], ["lang", false]] as const) {
        const language = params.get(parameter);
        if (language) {
            return {
                language,
                parameter: parameter.endsWith("forcelang") ? "forcelang" : "lang",
                live
            };
        }
    }

    return undefined;
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
