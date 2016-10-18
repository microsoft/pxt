namespace pxt.crowdin {
    export const PROJECT_VARIABLE = "CROWDIN_PROJECT";
    export const KEY_VARIABLE = "CROWDIN_KEY";

    function apiUri(prj: string, key: string, cmd: string, args?: Map<string>) {
        Util.assert(!!prj && !!key && !!cmd);
        const apiRoot = "https://api.crowdin.com/api/project/" + prj + "/";
        let suff = "?key=" + key;
        if (args) suff += "&" + Object.keys(args).map(k => `${k}=${encodeURIComponent(args[k])}`).join("&");
        return apiRoot + cmd + suff;
    }

    interface CrowdinProjectInfo {
        languages: { name: string; code: string; }[];
    }

    export function downloadTranslationsAsync(prj: string, key: string, filename: string): Promise<Map<Map<string>>> {
        const r: Map<Map<string>> = {};
        const infoUri = apiUri(prj, key, "info", { json: "true" });
        return Util.httpGetTextAsync(infoUri).then(respText => {
            const info = JSON.parse(respText) as CrowdinProjectInfo;
            if (!info) throw new Error("info failed")

            let todo = info.languages;
            let nextFile = (): Promise<void> => {
                const item = todo.pop();
                const exportFileUri = apiUri(prj, key, "export-file", {
                    file: filename,
                    language: item.code
                });
                pxt.debug(`downloading ${item.name}`)
                return Util.httpGetTextAsync(exportFileUri).then((transationsText) => {
                    try {
                        const translations = JSON.parse(transationsText) as Map<string>;
                        if (translations)
                            r[item.code] = translations;
                    } catch (e) {
                        pxt.log(exportFileUri + ' ' + e)
                    }
                    if (todo.length > 0) return nextFile();
                    else return Promise.resolve();
                }).delay(1000); // throttling otherwise crowding fails
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

    export function createDirectoryAsync(prj: string, key: string, name: string, incr?: () => void): Promise<void> {
        pxt.debug(`create directory ${name}`)
        if (!incr) incr = mkIncr(name);
        return Util.multipartPostAsync(apiUri(prj, key, "add-directory"), { json: "", name: name })
            .then(resp => {
                if (resp.statusCode == 200)
                    return Promise.resolve();

                const data: any = resp.json || { error: {} }
                if (resp.statusCode == 404 && data.error.code == 17) {
                    pxt.log(`parent directory missing for ${name}`)
                    const par = name.replace(/\/[^\/]+$/, "")
                    if (par != name) {
                        return createDirectoryAsync(prj, key, par, incr)
                            .then(() => createDirectoryAsync(prj, key, name, incr)); // retry
                    }
                }

                throw new Error(`cannot create dir ${name}: ${resp.toString()} ${JSON.stringify(data)}`)
            })
    }

    export function uploadTranslationAsync(prj: string, key: string, filename: string, jsondata: pxt.Map<string>) {
        Util.assert(!!prj);
        Util.assert(!!key);

        // normalize file name for crowdin
        filename = filename.replace(/\\/g, '/');

        const incr = mkIncr(filename);

        function startAsync(): Promise<void> {
            return uploadAsync("update-file", { update_option: "update_as_unapproved" })
        }

        function uploadAsync(op: string, opts: any): Promise<void> {
            opts["type"] = "auto";
            opts["json"] = "";
            incr();
            return Util.multipartPostAsync(apiUri(prj, key, op), opts, filename, JSON.stringify(jsondata))
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
                return createDirectoryAsync(prj, key, filename.replace(/\/[^\/]+$/, ""), incr)
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