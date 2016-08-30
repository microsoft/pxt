import * as db from "./db";
import * as core from "./core";
import * as pkg from "./package";
import * as data from "./data";
import * as ws from "./workspace";

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;
type InstallHeader = pxt.workspace.InstallHeader;
import U = pxt.Util;
import Cloud = pxt.Cloud;

/*
    interface WorkspaceProvider {
        getHeaders(): Header[];
        getHeader(id: string): Header;
        getTextAsync(id: string): Promise<ScriptText>;
        initAsync(target: string): Promise<void>;
        saveAsync(h: Header, text?: ScriptText): Promise<void>;
        installAsync(h0: InstallHeader, text: ScriptText): Promise<Header>;
        saveToCloudAsync(h: Header): Promise<void>;
        syncAsync(): Promise<void>;
        resetAsync(): Promise<void>;
    }
*/

interface Project {
    header: Header;
    text?: ScriptText;
}

let projects: U.Map<Project> = {};
let target = "";

function getHeaders(): Header[] {
    return Util.values(projects).map(p => p.header);
}

function getHeader(id: string): Header {
    let p = projects[id];
    return p ? p.header : undefined;
}

function getTextAsync(id: string): Promise<ScriptText> {
    let p = projects[id];
    return Promise.resolve(p ? p.text : undefined);
}

function initAsync(trg: string): Promise<void> {
    target = target;
    return Promise.resolve();
}

function saveAsync(h: Header, text?: ScriptText): Promise<void> {
    projects[h.id] = {
        header: h,
        text: text
    }
    return Promise.resolve();
}

function installAsync(h0: InstallHeader, text: ScriptText): Promise<Header> {
    let h = <Header>h0
    h.id = U.guidGen();
    h.recentUse = U.nowSeconds()
    h.modificationTime = h.recentUse;
    h.target = pxt.appTarget.id;

    return saveAsync(h, text).then(() => h);
}

function saveToCloudAsync(h: Header): Promise<void> {
    return Promise.resolve();
}

function syncAsync(): Promise<void> {
    return Promise.resolve();
}

function resetAsync(): Promise<void> {
    projects = {}
    target = "";
    return Promise.resolve();
}

export var provider: WorkspaceProvider = {
    getHeaders,
    getHeader,
    getTextAsync,
    initAsync,
    saveAsync,
    installAsync,
    saveToCloudAsync,
    syncAsync,
    resetAsync
}