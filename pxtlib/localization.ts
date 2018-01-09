namespace ts.pxtc.Util {
    // Localization functions. Please port any modifications over to pxtsim/localization.ts
    let _localizeLang: string = "en";
    let _localizeStrings: pxt.Map<string> = {};
    let _translationsCache: pxt.Map<pxt.Map<string>> = {};
    let _localizeExperimental = false; // load un-validated string and pop disclaimer dialog
    export var localizeLive = false;

    class MemTranslationDb implements ITranslationDb {
        translations: pxt.Map<ITranslationDbEntry> = {};
        key(lang: string, filename: string, branch: string) {
            return `${lang}|${filename}|${branch || ""}`;
        }
        getAsync(lang: string, filename: string, branch: string): Promise<ITranslationDbEntry> {
            return Promise.resolve(this.translations[this.key(lang, filename, branch)]);
        }
        setAsync(lang: string, filename: string, branch: string, etag: string, strings: pxt.Map<string>): Promise<void> {
            this.translations[this.key(lang, filename, branch)] = {
                etag,
                strings,
                cached: true
            }
            return Promise.resolve();
        }
    }

    // wired up in the app to store translations in pouchdb. MAY BE UNDEFINED!
    export var translationDb: ITranslationDb = new MemTranslationDb();

    /**
     * Returns the current user language, prepended by "live-" if in live mode
     */
    export function localeInfo(): string {
        return `${localizeLive ? "live-" : ""}${userLanguage()}`;
    }
    /**
     * Returns current user language iSO-code. Default is `en`.
     */
    export function userLanguage(): string {
        return _localizeLang;
    }

    export function isUserLanguageRtl(): boolean {
        // ar: Arabic
        // dv: Divehi
        // fa: Farsi
        // ha: Hausa
        // he: Hebrew
        // ks: Kashmiri
        // ku: Kurdish
        // ps: Pashto
        // ur: Urdu
        // yi: Yiddish
        return /^ar|dv|fa|ha|he|ks|ku|ps|ur|yi/i.test(_localizeLang);
    }

    export function _localize(s: string) {
        return _localizeStrings[s] || s;
    }

    export function downloadLiveTranslationsAsync(lang: string, filename: string, approved: boolean, branch?: string, etag?: string): Promise<pxt.Map<string>> {
        // hitting the cloud
        function downloadFromCloudAsync() {
            // https://pxt.io/api/translations?filename=strings.json&lang=pl&approved=true&branch=v0
            let url = `https://makecode.com/api/translations?lang=${encodeURIComponent(lang)}&filename=${encodeURIComponent(filename)}&approved=${approved ? "true" : "false"}`;
            if (branch) url += '&branch=' + encodeURIComponent(branch);
            const headers: pxt.Map<string> = {};
            if (etag) headers["If-None-Match"] = etag;
            return requestAsync({ url, headers }).then(resp => {
                // if 304, translation not changed, skipe
                if (resp.statusCode == 304)
                    return undefined;
                else if (resp.statusCode == 200) {
                    // store etag and translations
                    etag = resp.headers["ETag"] as string || "";
                    return translationDb.setAsync(lang, filename, branch, etag, resp.json)
                        .then(() => resp.json);
                }

                return resp.json;
            }, e => {
                console.log(`failed to load translations from ${url}`)
                return undefined;
            })
        }

        // check for cache
        return translationDb.getAsync(lang, filename, branch)
            .then((entry: ts.pxtc.Util.ITranslationDbEntry) => {
                // if cached, return immediately
                if (entry) {
                    etag = entry.etag;
                    // background update
                    if (!entry.cached)
                        downloadFromCloudAsync().done();
                    return entry.strings;
                } else
                    return downloadFromCloudAsync();
            })

    }

    export function getLocalizedStrings() {
        return _localizeStrings;
    }

    export function setLocalizedStrings(strs: pxt.Map<string>) {
        _localizeStrings = strs;
    }

    function normalizeLanguageCode(code: string): string {
        if (!/^(es|pt|si|sv|zh)/i.test(code))
            code = code.split("-")[0]
        return code;
    }

    export function updateLocalizationAsync(targetId: string, simulator: boolean, baseUrl: string, code: string, pxtBranch: string, targetBranch: string, live: boolean, experimental: boolean): Promise<void> {
        code = normalizeLanguageCode(code);
        if (code === _localizeLang)
            return Promise.resolve();

        return downloadTranslationsAsync(targetId, simulator, baseUrl, code, pxtBranch, targetBranch, live, experimental)
            .then((translations) => {
                if (translations) {
                    _localizeLang = code;
                    _localizeStrings = translations;
                    _localizeExperimental = !!experimental;
                    localizeLive = true;
                }
                return Promise.resolve();
            });
    }

    export function downloadSimulatorLocalizationAsync(
        targetId: string,
        baseUrl: string,
        code: string,
        pxtBranch: string,
        targetBranch: string,
        live: boolean,
        experimental: boolean): Promise<pxt.Map<string>> {
        code = normalizeLanguageCode(code);
        if (code === _localizeLang)
            return Promise.resolve<pxt.Map<string>>(undefined);

        return downloadTranslationsAsync(targetId, true, baseUrl, code, pxtBranch, targetBranch, live, experimental)
    }

    export function downloadTranslationsAsync(
        targetId: string,
        simulator: boolean,
        baseUrl: string,
        code: string,
        pxtBranch: string,
        targetBranch: string,
        live: boolean,
        experimental: boolean
    ): Promise<pxt.Map<string>> {
        code = normalizeLanguageCode(code);
        let translationsCacheId = `${code}/${live}/${simulator}`;
        if (_translationsCache[translationsCacheId]) {
            return Promise.resolve(_translationsCache[translationsCacheId]);
        }

        const stringFiles: { branch: string, path: string }[] = simulator
            ? [{ branch: targetBranch, path: targetId + "/sim-strings.json" }]
            : [
                { branch: pxtBranch, path: "strings.json" },
                { branch: targetBranch, path: targetId + "/target-strings.json" }
            ];
        let translations: pxt.Map<string>;

        function mergeTranslations(tr: pxt.Map<string>) {
            if (!tr) return;
            if (!translations) {
                translations = {};
            }
            Object.keys(tr)
                .filter(k => !!tr[k])
                .forEach(k => translations[k] = tr[k])
        }

        if (live) {
            let hadError = false;

            const pAll = Promise.mapSeries(stringFiles, (file) => downloadLiveTranslationsAsync(code, file.path, experimental, file.branch)
                .then(mergeTranslations, e => {
                    console.log(e.message);
                    hadError = true;
                })
            );

            return pAll.then(() => {
                // Cache translations unless there was an error for one of the files
                if (!hadError) {
                    _translationsCache[translationsCacheId] = translations;
                }
                return Promise.resolve(translations);
            });
        } else {
            return Util.httpGetJsonAsync(baseUrl + "locales/" + code + "/strings.json")
                .then(tr => {
                    if (tr) {
                        translations = tr;
                        _translationsCache[translationsCacheId] = translations;
                    }
                }, e => {
                    console.error('failed to load localizations')
                })
                .then(() => translations);
        }
    }
}    