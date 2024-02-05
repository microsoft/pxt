import * as db from "./db";
import * as workspace from "./workspace";
import * as pxteditor from "../../pxteditor";

let headerDb: db.Table;
let textDb: db.Table;

type Header = pxt.workspace.Header;
type ScriptText = pxteditor.workspace.ScriptText;
type WorkspaceProvider = pxteditor.workspace.WorkspaceProvider;

type TextDbEntry = {
    files?: ScriptText,
    // These are required by PouchDB/CouchDB
    id: string,
    _rev: any // This must be set to the return value of the last PouchDB/CouchDB
}

function migratePrefixesAsync(): Promise<void> {
    const currentVersion = pxt.semver.parse(pxt.appTarget.versions.target);
    const currentMajor = currentVersion.major;
    const currentDbPrefix = pxt.appTarget.appTheme.browserDbPrefixes && pxt.appTarget.appTheme.browserDbPrefixes[currentMajor];

    if (!currentDbPrefix) {
        // This version does not use a prefix for storing projects, so just use default tables
        headerDb = new db.Table("header");
        textDb = new db.Table("text");
        return Promise.resolve();
    }

    headerDb = new db.Table(`${currentDbPrefix}-header`);
    textDb = new db.Table(`${currentDbPrefix}-text`);

    return headerDb.getAllAsync()
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
                    return pxt.Util.promiseMapAll(previousHeaders, (h) => copyProject(h));
                })
                .then(() => { });
        });
}

async function migrateSkillmapProjectsAsync() {
    const skillmapWorkspace = new pxt.skillmap.IndexedDBWorkspace();
    await skillmapWorkspace.initAsync()

    const projects = await skillmapWorkspace.getAllProjectsAsync();

    for (const project of projects) {
        project.header.isSkillmapProject = true;
        await workspace.installAsync(project.header, project.text, true);
        await skillmapWorkspace.deleteProjectAsync(project.header.id);
    }
}

async function listAsync(): Promise<pxt.workspace.Header[]> {
    await migratePrefixesAsync()
    await migrateSkillmapProjectsAsync();
    return headerDb.getAllAsync() as Promise<Header[]>;
}

async function getAsync(h: Header): Promise<pxteditor.workspace.File> {
    const hdrProm = headerDb.getAsync(h.id)
    const textProm = textDb.getAsync(h.id)
    let [hdrResp, textResp] = await Promise.all([hdrProm, textProm]) as [Header, TextDbEntry]
    if (!hdrResp || !textResp)
        return undefined
    return {
        header: hdrResp,
        text: textResp.files,
        version: textResp._rev
    }
}

function setAsync(h: Header, prevVer: any, text?: ScriptText) {
    return setCoreAsync(headerDb, textDb, h, prevVer, text);
}

function setCoreAsync(headers: db.Table, texts: db.Table, h: Header, prevVer: any, text?: ScriptText) {
    let newTextVer = ""
    const textRes = (!text ? Promise.resolve() :
        texts.setAsync({
            id: h.id,
            files: text,
            _rev: prevVer
        }).then(rev => {
            newTextVer = rev
        }))
    const headerRes = textRes
        .then(() => headers.setAsync(h))
        .then(rev => {
            h._rev = rev
            return newTextVer
        });
    return headerRes
}

export async function copyProjectToLegacyEditor(header: Header, script: pxteditor.workspace.ScriptText, majorVersion: number): Promise<void> {
    const prefix = pxt.appTarget.appTheme.browserDbPrefixes && pxt.appTarget.appTheme.browserDbPrefixes[majorVersion];

    const oldHeaders = new db.Table(prefix ? `${prefix}-header` : `header`);
    const oldTexts = new db.Table(prefix ? `${prefix}-text` : `text`);

    await setCoreAsync(oldHeaders, oldTexts, header, undefined, script);
}

function deleteAsync(h: Header, prevVer: any) {
    return headerDb.deleteAsync(h)
        .then(() => textDb.deleteAsync({ id: h.id, _rev: h._rev }));
}

function resetAsync() {
    // workspace.resetAsync already clears all tables
    return Promise.resolve();
}

function loadedAsync(): Promise<void> {
    return pxt.commands.workspaceLoadedAsync?.();
}

export const provider: WorkspaceProvider = {
    getAsync,
    setAsync,
    deleteAsync,
    listAsync,
    resetAsync,
    loadedAsync
}