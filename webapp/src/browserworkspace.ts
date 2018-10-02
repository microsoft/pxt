import * as db from "./db";

let headers: db.Table;
let texts: db.Table;

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;

function migratePrefixesAsync(): Promise<void> {
    const currentVersion = pxt.semver.parse(pxt.appTarget.versions.target);
    const currentMajor = currentVersion.major;
    const currentDbPrefix = pxt.appTarget.appTheme.browserDbPrefixes && pxt.appTarget.appTheme.browserDbPrefixes[currentMajor];

    if (!currentDbPrefix) {
        // This version does not use a prefix for storing projects, so just use default tables
        headers = new db.Table("header");
        texts = new db.Table("text");
        return Promise.resolve();
    }

    headers = new db.Table(`${currentDbPrefix}-header`);
    texts = new db.Table(`${currentDbPrefix}-text`);

    return headers.getAllAsync()
        .then((allDbHeaders) => {
            if (allDbHeaders.length) {
                // There are already scripts using the prefix, so a migration has already happened
                return Promise.resolve();
            }

            // No headers using this prefix yet, attempt to migrate headers from previous major version (or default tables)
            const previousMajor = currentMajor - 1;
            const previousDbPrefix = previousMajor < 0 ? "" : pxt.appTarget.appTheme.browserDbPrefixes && pxt.appTarget.appTheme.browserDbPrefixes[previousMajor];
            let previousHeaders = new db.Table("header");
            let previousTexts = new db.Table("text");

            if (previousDbPrefix) {
                previousHeaders = new db.Table(`${previousDbPrefix}-header`);
                previousTexts = new db.Table(`${previousDbPrefix}-text`);
            }

            const copyProject = (h: pxt.workspace.Header): Promise<string> => {
                return previousTexts.getAsync(h.id)
                    .then((resp) => {
                        // Ignore metadata of the previous script so they get re-generated for the new copy
                        delete (<any>h)._id;
                        delete (<any>h)._rev;
                        return setAsync(h, undefined, resp.files);
                    });
            };

            return previousHeaders.getAllAsync()
                .then((previousHeaders: pxt.workspace.Header[]) => {
                    return Promise.map(previousHeaders, (h) => copyProject(h));
                })
                .then(() => { });
        });
}

function listAsync(): Promise<pxt.workspace.Header[]> {
    return migratePrefixesAsync()
        .then(() => headers.getAllAsync());
}

function getAsync(h: Header): Promise<pxt.workspace.File> {
    return texts.getAsync(h.id)
        .then(resp => ({
            header: h,
            text: resp.files,
            version: resp._rev
        }));
}

function setAsync(h: Header, prevVer: any, text?: ScriptText) {
    return setCoreAsync(headers, texts, h, prevVer, text);
}

function setCoreAsync(headers: db.Table, texts: db.Table, h: Header, prevVer: any, text?: ScriptText) {
    let retrev = ""
    return (!text ? Promise.resolve() :
        texts.setAsync({
            id: h.id,
            files: text,
            _rev: prevVer
        }).then(rev => {
            retrev = rev
        }))
        .then(() => headers.setAsync(h))
        .then(rev => {
            h._rev = rev
            return retrev
        });
}

export function copyProjectToLegacyEditor(h: Header, majorVersion: number): Promise<Header> {
    const prefix = pxt.appTarget.appTheme.browserDbPrefixes && pxt.appTarget.appTheme.browserDbPrefixes[majorVersion];

    const oldHeaders = new db.Table(prefix ? `${prefix}-header` : `header`);
    const oldTexts = new db.Table(prefix ? `${prefix}-text` : `text`);

    const header = pxt.Util.clone(h);
    delete (header as any)._id;
    delete header._rev;
    header.id = pxt.Util.guidGen();

    return getAsync(h)
        .then(resp => setCoreAsync(oldHeaders, oldTexts, header, undefined, resp.text))
        .then(rev => header);
}

function deleteAsync(h: Header, prevVer: any) {
    return headers.deleteAsync(h)
        .then(() => texts.deleteAsync({ id: h.id, _rev: h._rev }));
}

function resetAsync() {
    // workspace.resetAsync already clears all tables
    return Promise.resolve();
}
export const provider: WorkspaceProvider = {
    getAsync,
    setAsync,
    deleteAsync,
    listAsync,
    resetAsync,
}