namespace pxt.crowdin {
    export const KEY_VARIABLE = "CROWDIN_KEY";

    function apiUri(branch: string, prj: string, key: string, cmd: string, args?: Map<string>) {
        Util.assert(!!prj && !!key && !!cmd);
        const apiRoot = "https://api.crowdin.com/api/project/" + prj + "/";
        let suff = "?key=" + key;
        if (branch) {
            if (!args) args = {};
            args["branch"] = branch;
        }
        if (args) suff += "&" + Object.keys(args).map(k => `${k}=${encodeURIComponent(args[k])}`).join("&");
        return apiRoot + cmd + suff;
    }

    interface CrowdinProjectInfo {
        languages: { name: string; code: string; }[];
    }

    export interface DownloadOptions {
        translatedOnly?: boolean;
        validatedOnly?: boolean;
    }

    export function downloadTranslationsAsync(branch: string, prj: string, key: string, filename: string, options: DownloadOptions = {}): Promise<Map<Map<string>>> {
        const q: Map<string> = { json: "true" }
        const infoUri = apiUri(branch, prj, key, "info", q);

        const r: Map<Map<string>> = {};
        filename = normalizeFileName(filename);
        return Util.httpGetTextAsync(infoUri).then(respText => {
            const info = JSON.parse(respText) as CrowdinProjectInfo;
            if (!info) throw new Error("info failed")

            const todo = info.languages;
            pxt.log('languages: ' + todo.map(l => l.code).join(', '));
            const nextFile = (): Promise<void> => {
                const item = todo.pop();
                if (!item) return Promise.resolve();
                const exportFileUri = apiUri(branch, prj, key, "export-file", {
                    file: filename,
                    language: item.code,
                    export_translated_only: options.translatedOnly ? "1" : "0",
                    export_approved_only: options.validatedOnly ? "1" : "0"
                });
                pxt.log(`downloading ${item.name} - ${item.code} (${todo.length} more)`)
                return Util.httpGetTextAsync(exportFileUri).then((transationsText) => {
                    try {
                        const translations = JSON.parse(transationsText) as Map<string>;
                        if (translations)
                            r[item.code] = translations;
                    } catch (e) {
                        pxt.log(exportFileUri + ' ' + e)
                    }
                    return nextFile();
                }).delay(1000); // throttling otherwise crowdin fails
            };

            return nextFile();
        }).then(() => r);
    }

    function mkIncr(filename: string): () => void {
        let cnt = 0
        return function incr() {
            if (cnt++ > 10) {
                throw new Error("Too many API calls for " + filename);
            }
        }
    }

    export function createDirectoryAsync(branch: string, prj: string, key: string, name: string, incr?: () => void): Promise<void> {
        name = normalizeFileName(name);
        pxt.debug(`create directory ${branch || ""}/${name}`)
        if (!incr) incr = mkIncr(name);
        return Util.multipartPostAsync(apiUri(branch, prj, key, "add-directory"), { json: "true", name: name })
            .then(resp => {
                pxt.debug(`crowdin resp: ${resp.statusCode}`)
                // 400 returned by folder already exists
                if (resp.statusCode == 200 || resp.statusCode == 400)
                    return Promise.resolve();

                if (resp.statusCode == 500 && resp.text) {
                    const json = JSON.parse(resp.text);
                    if (json.error.code === 50) {
                        pxt.log('directory already exists')
                        return Promise.resolve();
                    }
                }

                const data: any = resp.json || JSON.parse(resp.text) || { error: {} }
                if (resp.statusCode == 404 && data.error.code == 17) {
                    pxt.log(`parent directory missing for ${name}`)
                    const par = name.replace(/\/[^\/]+$/, "")
                    if (par != name) {
                        return createDirectoryAsync(branch, prj, key, par, incr)
                            .then(() => createDirectoryAsync(branch, prj, key, name, incr)); // retry
                    }
                }

                throw new Error(`cannot create directory ${branch || ""}/${name}: ${resp.statusCode} ${JSON.stringify(data)}`)
            })
    }

    function normalizeFileName(filename: string): string {
        return filename.replace(/\\/g, '/');
    }

    export function uploadTranslationAsync(branch: string, prj: string, key: string, filename: string, data: string) {
        Util.assert(!!prj);
        Util.assert(!!key);

        filename = normalizeFileName(filename);
        const incr = mkIncr(filename);

        function startAsync(): Promise<void> {
            return uploadAsync("update-file", { update_option: "update_as_unapproved" })
        }

        function uploadAsync(op: string, opts: any): Promise<void> {
            opts["type"] = "auto";
            opts["json"] = "";
            opts["escape_quotes"] = "0";
            incr();
            return Util.multipartPostAsync(apiUri(branch, prj, key, op), opts, filename, data)
                .then(resp => handleResponseAsync(resp))
        }

        function handleResponseAsync(resp: Util.HttpResponse) {
            const code = resp.statusCode;
            const data: any = JSON.parse(resp.text);

            pxt.debug(`upload result: ${code}`);
            if (code == 404 && data.error.code == 8) {
                pxt.log(`create new translation file: ${filename}`)
                return uploadAsync("add-file", {})
            }
            else if (code == 404 && data.error.code == 17) {
                return createDirectoryAsync(branch, prj, key, filename.replace(/\/[^\/]+$/, ""), incr)
                    .then(() => startAsync())
            } else if (code == 200) {
                return Promise.resolve()
            } else {
                throw new Error(`Error, upload translation: ${filename}, ${resp}, ${JSON.stringify(data)}`)
            }
        }

        return startAsync();
    }
}