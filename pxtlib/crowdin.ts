namespace pxt.crowdin {
    export const KEY_VARIABLE = "CROWDIN_KEY";
    export let testMode = false;
    export const TEST_KEY = "!!!testmode!!!";

    export function setTestMode() {
        pxt.crowdin.testMode = true;
        pxt.log(`CROWDIN TEST MODE - files will NOT be uploaded`);
    }

    function multipartPostAsync(key: string, uri: string, data: any = {}, filename: string = null, filecontents: string = null): Promise<ts.pxtc.Util.HttpResponse> {
        if (testMode || key == TEST_KEY) {
            const resp = {
                success: true
            }
            return Promise.resolve({ statusCode: 200, headers: {}, text: JSON.stringify(resp), json: resp })
        }
        return Util.multipartPostAsync(uri, data, filename, filecontents);
    }

    function apiUri(branch: string, prj: string, key: string, cmd: string, args?: Map<string>) {
        Util.assert(!!prj && !!key && !!cmd);
        const apiRoot = "https://api.crowdin.com/api/project/" + prj + "/";
        args = args || {};
        if (testMode)
            delete args["key"]; // ensure no key is passed in test mode
        else
            args["key"] = key;
        if (branch)
            args["branch"] = branch;
        return apiRoot + cmd + "?" + Object.keys(args).map(k => `${k}=${encodeURIComponent(args[k])}`).join("&");
    }

    export interface CrowdinFileInfo {
        name: string;
        fullName?: string;
        id: number;
        node_type: "file" | "directory" | "branch";
        phrases?: number;
        translated?: number;
        approved?: number;
        branch?: string;
        files?: CrowdinFileInfo[];
    }

    export interface CrowdinProjectInfo {
        languages: { name: string; code: string; }[];
        files: CrowdinFileInfo[];
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

            let todo = info.languages.filter(l => l.code != "en");
            if (pxt.appTarget && pxt.appTarget.appTheme && pxt.appTarget.appTheme.availableLocales)
                todo = todo.filter(l => pxt.appTarget.appTheme.availableLocales.indexOf(l.code) > -1);
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
        return multipartPostAsync(key, apiUri(branch, prj, key, "add-directory"), { json: "true", name: name })
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
            return multipartPostAsync(key, apiUri(branch, prj, key, op), opts, filename, data)
                .then(resp => handleResponseAsync(resp))
        }

        function handleResponseAsync(resp: Util.HttpResponse) {
            const code = resp.statusCode;
            const errorData: {
                success?: boolean;
                error?: {
                    code: number;
                }
            } = Util.jsonTryParse(resp.text) || {};

            pxt.debug(`upload result: ${code}`);
            if (code == 404 && errorData.error && errorData.error.code == 8) {
                pxt.log(`create new translation file: ${filename}`)
                return uploadAsync("add-file", {})
            }
            else if (code == 404 && errorData.error && errorData.error.code == 17) {
                return createDirectoryAsync(branch, prj, key, filename.replace(/\/[^\/]+$/, ""), incr)
                    .then(() => startAsync())
            } else if (!errorData.success && errorData.error && errorData.error.code == 53) {
                // file is being updated
                pxt.log(`${filename} being updated, waiting 5s and retry...`)
                return Promise.delay(5000) // wait 5s and try again
                    .then(() => uploadTranslationAsync(branch, prj, key, filename, data));
            } else if (code == 200 || errorData.success) {
                // something crowdin reports 500 with success=true
                return Promise.resolve()
            } else {
                throw new Error(`Error, upload translation: ${filename}, ${code}, ${resp.text}`)
            }
        }

        return startAsync();
    }

    function flatten(allFiles: CrowdinFileInfo[], node: CrowdinFileInfo, parentDir: string, branch?: string) {
        const n = node.name;
        const d = parentDir ? parentDir + "/" + n : n;
        node.fullName = d;
        node.branch = branch || "";
        switch (node.node_type) {
            case "file":
                allFiles.push(node);
                break;
            case "directory":
                (node.files || []).forEach(f => flatten(allFiles, f, d, branch));
                break;
            case "branch":
                (node.files || []).forEach(f => flatten(allFiles, f, parentDir, node.name));
                break;
        }
    }

    function filterAndFlattenFiles(files: CrowdinFileInfo[], crowdinPath?: string): CrowdinFileInfo[] {
        const pxtCrowdinBranch = pxt.appTarget.versions.pxtCrowdinBranch || "";
        const targetCrowdinBranch = pxt.appTarget.versions.targetCrowdinBranch || "";

        let allFiles: CrowdinFileInfo[] = [];

        // flatten the files
        files.forEach(f => flatten(allFiles, f, ""));

        // top level files are for PXT, subolder are targets
        allFiles = allFiles.filter(f => {
            if (f.fullName.indexOf('/') < 0) return f.branch == pxtCrowdinBranch; // pxt file
            else return f.branch == targetCrowdinBranch;
        })

        // folder filter
        if (crowdinPath) {
            // filter out crowdin folder
            allFiles = allFiles.filter(f => f.fullName.indexOf(crowdinPath) == 0);
        }

        // filter out non-target files
        if (pxt.appTarget.id != "core") {
            const id = pxt.appTarget.id + '/'
            allFiles = allFiles.filter(f => {
                return f.fullName.indexOf('/') < 0 // top level file
                    || f.fullName.substr(0, id.length) == id // from the target folder
                    || f.fullName.indexOf('common-docs') >= 0 // common docs
            })
        }

        return allFiles;
    }

    export function projectInfoAsync(prj: string, key: string): Promise<CrowdinProjectInfo> {
        const q: Map<string> = { json: "true" }
        const infoUri = apiUri("", prj, key, "info", q);
        return Util.httpGetTextAsync(infoUri).then(respText => {
            const info = JSON.parse(respText) as CrowdinProjectInfo;
            return info;
        });
    }

    /**
     * Scans files in crowdin and report files that are not on disk anymore
     */
    export function listFilesAsync(prj: string, key: string, crowdinPath: string): Promise<{ fullName: string; branch: string; }[]> {

        pxt.log(`crowdin: listing files under ${crowdinPath}`);

        return projectInfoAsync(prj, key)
            .then(info => {
                if (!info) throw new Error("info failed")

                let allFiles = filterAndFlattenFiles(info.files, crowdinPath);
                pxt.debug(`crowdin: found ${allFiles.length} under ${crowdinPath}`)

                return allFiles.map(f => {
                    return {
                        fullName: f.fullName,
                        branch: f.branch || ""
                    };
                })
            });
    }

    export function languageStatsAsync(prj: string, key: string, lang: string): Promise<CrowdinFileInfo[]> {
        const uri = apiUri("", prj, key, "language-status", { language: lang, json: "true" });

        return Util.httpGetJsonAsync(uri)
            .then(info => {
                const allFiles = filterAndFlattenFiles(info.files);
                return allFiles;
            });
    }

    export function inContextLoadAsync(text: string): Promise<string> {
        const node = document.createElement("input") as HTMLInputElement;
        node.type = "text";
        node.setAttribute("class", "hidden");
        node.value = text;
        let p = new Promise<string>((resolve, reject) => {
            const observer = new MutationObserver(() => {
                if (text == node.value)
                    return;
                const r = Util.rlf(node.value); // get rid of {id}...
                node.remove();
                observer.disconnect();
                resolve(r);
            });
            observer.observe(node, { attributes: true });
        })
        document.body.appendChild(node);

        return p;
    }
}