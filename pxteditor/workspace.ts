/// <reference path="../built/pxtlib.d.ts"/>

namespace pxt.workspace {
    export type ScriptText = pxt.Map<string>;

    export interface Project {
        header?: Header;
        text?: ScriptText;
    }

    export interface Asset {
        name: string;
        size: number;
        url: string;
    }

    export type Version = any;

    export interface File {
        header: Header;
        text: ScriptText;
        version: Version;
    }

    export interface HistoryEntry {
        timestamp: number;
        changes: FileChange[];
    }

    export type FileChange = FileAddedChange | FileRemovedChange | FileEditedChange;

    export interface FileAddedChange {
        type: "added";
        filename: string;
        value: string;
    }

    export interface FileRemovedChange {
        type: "removed";
        filename: string;
        value: string;
    }

    export interface FileEditedChange {
        type: "edited";
        filename: string;

        // We always store the current file so this is a backwards patch
        patch: any;
    }

    export interface WorkspaceProvider {
        listAsync(): Promise<Header[]>; // called from workspace.syncAsync (including upon startup)
        getAsync(h: Header): Promise<File>;
        setAsync(h: Header, prevVersion: Version, text?: ScriptText): Promise<Version>;
        deleteAsync?: (h: Header, prevVersion: Version) => Promise<void>;
        resetAsync(): Promise<void>;
        loadedAsync?: () => Promise<void>;
        getSyncState?: () => pxt.editor.EditorSyncState;

        // optional screenshot support
        saveScreenshotAsync?: (h: Header, screenshot: string, icon: string) => Promise<void>;

        // optional asset (large binary file) support
        saveAssetAsync?: (id: string, filename: string, data: Uint8Array) => Promise<void>;
        listAssetsAsync?: (id: string) => Promise<Asset[]>;

        fireEvent?: (ev: pxt.editor.events.Event) => void;
    }

    export function freshHeader(name: string, modTime: number) {
        let header: Header = {
            target: pxt.appTarget.id,
            targetVersion: pxt.appTarget.versions.target,
            name: name,
            meta: {},
            editor: pxt.JAVASCRIPT_PROJECT_NAME,
            pubId: "",
            pubCurrent: false,
            _rev: null,
            historyRev: null,
            id: U.guidGen(),
            recentUse: modTime,
            modificationTime: modTime,
            cloudUserId: null,
            cloudCurrent: false,
            cloudVersion: null,
            cloudLastSyncTime: 0,
            isDeleted: false,
        }
        return header
    }

    export function collapseHistory(history: HistoryEntry[], text: ScriptText, interval: number,  diff: (a: string, b: string) => unknown, patch: (p: unknown, text: string) => string) {
        const newHistory: HistoryEntry[] = [];

        let current = text;
        let lastTime = history[history.length - 1].timestamp;
        let lastTimeIndex = history.length - 1;
        let lastTimeText = {...text};

        for (let i = history.length - 1; i >= 0; i--) {
            const entry = history[i];

            if (lastTime - entry.timestamp > interval) {
                if (lastTimeIndex - i > 1) {
                    newHistory.unshift({
                        timestamp: lastTime,
                        changes: diffScriptText(current, lastTimeText, diff).changes
                    })
                }
                else {
                    newHistory.unshift(history[lastTimeIndex]);
                }

                current = applyDiff(current, entry, patch);

                lastTimeIndex = i;
                lastTimeText = {...current}
                lastTime = entry.timestamp;
            }
            else {
                current = applyDiff(current, entry, patch);
            }
        }

        if (lastTimeIndex) {
            newHistory.unshift({
                timestamp: lastTime,
                changes: diffScriptText(current, lastTimeText, diff).changes
            })
        }
        else {
            newHistory.unshift(history[0]);
        }

        return newHistory;
    }

    export function diffScriptText(oldVersion: pxt.workspace.ScriptText, newVersion: pxt.workspace.ScriptText, diff: (a: string, b: string) => unknown): pxt.workspace.HistoryEntry {
        const changes: pxt.workspace.FileChange[] = [];

        for (const file of Object.keys(oldVersion)) {
            if (!(file.endsWith(".ts") || file.endsWith(".jres") || file.endsWith(".py") || file.endsWith(".blocks") || file === "pxt.json")) continue;
            if (newVersion[file] == undefined) {
                changes.push({
                    type: "removed",
                    filename: file,
                    value: oldVersion[file]
                });
            }
            else if (oldVersion[file] !== newVersion[file]) {
                changes.push({
                    type: "edited",
                    filename: file,
                    patch: diff(newVersion[file], oldVersion[file])
                });
            }
        }

        for (const file of Object.keys(newVersion)) {
            if (!(file.endsWith(".ts") || file.endsWith(".jres") || file.endsWith(".py") || file.endsWith(".blocks") || file === "pxt.json")) continue;

            if (oldVersion[file] == undefined) {
                changes.push({
                    type: "added",
                    filename: file,
                    value: newVersion[file]
                });
            }
        }

        if (!changes.length) return undefined;

        return {
            timestamp: Date.now(),
            changes
        }
    }

    export function applyDiff(text: ScriptText, history: pxt.workspace.HistoryEntry, patch: (p: unknown, text: string) => string) {
        for (const change of history.changes) {
            if (change.type === "added") {
                delete text[change.filename]
            }
            else if (change.type === "removed") {
                text[change.filename] = change.value;
            }
            else {
                text[change.filename] = patch(change.patch, text[change.filename]);
            }
        }

        return text;
    }
}