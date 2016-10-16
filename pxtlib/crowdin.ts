namespace pxt.crowdin {

    export function uploadTranslationAsync(prj: string, key: string, filename: string, jsondata: pxt.Map<string>) {
        Util.assert(!!prj);
        Util.assert(!!key);
        let cnt = 0
        const apiRoot = "https://api.crowdin.com/api/project/" + prj + "/";
        const suff = "?key=" + key;

        function incr() {
            if (cnt++ > 10) {
                throw new Error("Too many API calls for " + filename);
            }
        }

        function createDirAsync(name: string) {
            return createDir0Async(name);
        }

        function createDir0Async(name: string): Promise<void> {
            pxt.debug(`create directory ${name}`)
            incr();
            return Util.multipartPostAsync(apiRoot + "add-directory" + suff, { json: "", name: name })
                .then(resp => {
                    if (resp.statusCode == 200)
                        return Promise.resolve();

                    const data: any = resp.json || { error: {} }
                    if (resp.statusCode == 404 && data.error.code == 17) {
                        pxt.log(`parent directory missing for ${name}`)
                        const par = name.replace(/\/[^\/]+$/, "")
                        if (par != name) {
                            return createDirAsync(par)
                                .then(() => createDirAsync(name)); // retry
                        }
                    }

                    throw new Error(`cannot create dir ${name}: ${resp.toString()} ${JSON.stringify(data)}`)
                })
        }

        function startAsync(): Promise<void> {
            return uploadAsync("update-file", { update_option: "update_as_unapproved" })
        }

        function uploadAsync(op: string, opts: any): Promise<void> {
            opts["type"] = "auto";
            opts["json"] = "";
            incr();
            return Util.multipartPostAsync(apiRoot + op + suff, opts, filename, JSON.stringify(jsondata))
                .then(resp => handleResponseAsync(resp))
        }

        function handleResponseAsync(resp: Util.HttpResponse) {
            const code = resp.statusCode;
            const data: any = JSON.parse(resp.text);

            console.log(`upload result: ${code}`);
            if (code == 404 && data.error.code == 8) {
                pxt.log(`create new translation file: ${filename}`)
                return uploadAsync("add-file", {})
            }
            else if (code == 404 && data.error.code == 17) {
                return createDirAsync(filename.replace(/\/[^\/]+$/, ""))
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