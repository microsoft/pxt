import ScriptText = pxt.workspace.ScriptText;

export interface HistoryFile {
    entries: HistoryEntry[];
    snapshots: SnapshotEntry[];
    shares: ShareEntry[];
    lastSaveTime: number;
}

export interface HistoryEntry {
    timestamp: number;
    editorVersion: string;
    changes: FileChange[];
}

export interface SnapshotEntry {
    timestamp: number;
    editorVersion: string;
    text: ScriptText;
}

export interface ShareEntry {
    timestamp: number;
    id: string;
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

export interface CollapseHistoryOptions {
    // the interval in milliseconds at which to collapse history entries
    interval: number;

    // the minimum time of entries that are subject to collapsing (inclusive)
    minTime?: number;

    // the maximum time of entries that are subject to collapsing (inclusive)
    maxTime?: number;
}

// 5 minutes. This is overridden in pxtarget.json
const DEFAULT_DIFF_HISTORY_INTERVAL = 1000 * 60 * 5;

// 30 minutes. This is overridden in pxtarget.json
const DEFAULT_SNAPSHOT_HISTORY_INTERVAL = 1000 * 60 * 30;

const ONE_DAY = 1000 * 60 * 60 * 24;

const TWO_HOURS = 1000 * 60 * 60 * 2;

/**
 * Collapses the history file in a given script text object. This modifies the text object in
 * place and will always preserve the first history entry regardless of the minTime and maxTime
 * passed in through the options. This function only collapses diff entries; snapshots and shares
 * are not collapsed.
 *
 * For example, if you wanted to collapse history entries that are older than one day so that we\
 * don't store more than one history entry per day, you could do:
 *
 * interval = 1000 * 60 * 60 * 24; // one day
 * maxTime = Data.now() - 1000 * 60 * 60 * 24; // one day ago
 *
 */
export function collapseHistory(text: ScriptText, options: CollapseHistoryOptions, diff: (a: string, b: string) => unknown, patch: (p: unknown, text: string) => string) {
    if (!text[pxt.HISTORY_FILE]) return;

    const history: HistoryFile = parseHistoryFile(text[pxt.HISTORY_FILE]);
    const newHistory = collapseHistoryCore(history, text, options, diff, patch);

    text[pxt.HISTORY_FILE] = JSON.stringify(newHistory);
}

function collapseHistoryCore(history: HistoryFile, text: ScriptText, options: CollapseHistoryOptions, diff: (a: string, b: string) => unknown, patch: (p: unknown, text: string) => string) {
    const newHistory: HistoryEntry[] = [];
    const entries = history.entries.slice();

    let current = {...text};
    let { interval, minTime, maxTime } = options;

    if (minTime === undefined) {
        minTime = 0;
    }
    if (maxTime === undefined) {
        maxTime = history.lastSaveTime;
    }

    let lastHistoryEntry: ScriptText = {...current};
    let lastTime: number = history.lastSaveTime;

    while (entries.length) {
        const entry = entries.pop();
        current = applyDiff(current, entry, patch);

        if (entry.timestamp > maxTime) {
            newHistory.unshift(entry);
            lastHistoryEntry = {...current};
            lastTime = entry.timestamp;
        }
        else if (entry.timestamp < minTime) {
            if (lastHistoryEntry) {
                newHistory.unshift({
                    timestamp: entry.timestamp,
                    editorVersion: entry.editorVersion,
                    changes: diffScriptText(current, lastHistoryEntry, entry.timestamp, diff).changes
                });
                lastHistoryEntry = undefined;
            }
            else {
                newHistory.unshift(entry);
            }
        }
        else if (lastTime - entry.timestamp >= interval) {
            newHistory.unshift({
                timestamp: entry.timestamp,
                editorVersion: entry.editorVersion,
                changes: diffScriptText(current, lastHistoryEntry, entry.timestamp, diff).changes
            });
            lastHistoryEntry = {...current};
            lastTime = entry.timestamp;
        }
    }

    if (lastHistoryEntry && lastTime > history.entries[0].timestamp) {
        // always preserve the first entry in the history
        newHistory.unshift({
            timestamp: history.entries[0].timestamp,
            editorVersion: history.entries[0].editorVersion,
            changes: diffScriptText(current, lastHistoryEntry, history.entries[0].timestamp, diff).changes
        });
    }

    return {
        ...history,
        entries: newHistory,
    };
}

export function diffScriptText(oldVersion: ScriptText, newVersion: ScriptText, time: number, diff: (a: string, b: string) => unknown): HistoryEntry {
    const changes: FileChange[] = [];

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
        timestamp: time,
        editorVersion: pxt.appTarget?.versions?.target,
        changes
    }
}

export function applyDiff(text: ScriptText, history: HistoryEntry, patch: (p: unknown, text: string) => string) {
    const result = { ...text };
    for (const change of history.changes) {
        if (change.type === "added") {
            delete result[change.filename]
        }
        else if (change.type === "removed") {
            result[change.filename] = change.value;
        }
        else {
            result[change.filename] = patch(change.patch, text[change.filename]);
        }
    }

    return result;
}

export function createSnapshot(text: ScriptText) {
    let result: ScriptText;
    try {
        result = {};
        const config: pxt.PackageConfig = JSON.parse(text[pxt.CONFIG_NAME]);

        for (const file of config.files) {
            // these files will just get regenrated
            if (file === pxt.IMAGES_CODE || file === pxt.TILEMAP_CODE) {
                result[file] = "";
            }
            else {
                result[file] = text[file];
            }
        }

        result[pxt.CONFIG_NAME] = text[pxt.CONFIG_NAME];

        // main.ts will also be regenerated if blocks/python
        if (config.preferredEditor === pxt.BLOCKS_PROJECT_NAME) {
            if (result[pxt.MAIN_BLOCKS]) result[pxt.MAIN_TS] = "";
        }
        else if (config.preferredEditor === pxt.PYTHON_PROJECT_NAME) {
            if (result[pxt.MAIN_PY]) result[pxt.MAIN_TS] = "";
        }

        if (config.testFiles) {
            for (const file of config.testFiles) {
                result[file] = text[file];
            }
        }

        return result;
    }
    catch(e) {
        result = { ...text };
    }

    if (result[pxt.HISTORY_FILE]) {
        // don't include the history file in the snapshot
        delete result[pxt.HISTORY_FILE];
    }

    return result;
}

export function applySnapshot(text: ScriptText, snapshot: ScriptText) {
    try {
        const result: ScriptText = { ...snapshot };
        const config: pxt.PackageConfig = JSON.parse(text[pxt.CONFIG_NAME]);

        // preserve any files from the current text that aren't in the config; this is just to make
        // sure that our internal files like history, markdown, serial output are preserved
        for (const file of Object.keys(text)) {
            // we had a bug at one point where the history file was included in snapshots
            if (file === pxt.HISTORY_FILE) continue;

            if (config.files.indexOf(file) === -1 && config.testFiles?.indexOf(file) === -1 && !result[file]) {
                result[file] = text[file];
            }
        }

        return result;
    }
    catch (e) {
        const result = { ...text };
        for (const file of Object.keys(snapshot)) {
            result[file] = snapshot[file]
        }

        return result;
    }
}

export function parseHistoryFile(text: string): HistoryFile {
    const result: HistoryFile = JSON.parse(text);

    if (!result.entries) result.entries = [];
    if (!result.shares) result.shares = [];
    if (!result.snapshots) result.snapshots = [];

    return result;
}

export function updateHistory(previousText: ScriptText, toWrite: ScriptText, currentTime: number, shares: pxt.workspace.PublishVersion[], diff: (a: string, b: string) => unknown, patch: (p: unknown, text: string) => string, collapseHistory: boolean = false) {
    let history: HistoryFile;

    // Always base the history off of what was in the previousText,
    // which is written to disk. The new text could have corrupted it
    // in some way
    if (previousText[pxt.HISTORY_FILE]) {
        history = parseHistoryFile(previousText[pxt.HISTORY_FILE]);
        if (history.lastSaveTime === undefined) {
            history.lastSaveTime = currentTime;
        }
    }
    else {
        history = {
            entries: [],
            snapshots: [takeSnapshot(previousText, currentTime - 1)],
            shares: [],
            lastSaveTime: currentTime
        };
    }

    const previousSaveTime = history.lastSaveTime;

    // First save any new project shares
    for (const share of shares) {
        if (!history.shares.some(s => s.id === share.id)) {
            history.shares.push({
                id: share.id,
                timestamp: currentTime,
            });
        }
    }

    // If no source changed, we can bail at this point
    if (scriptEquals(previousText, toWrite)) {
        toWrite[pxt.HISTORY_FILE] = JSON.stringify(history);
        return;
    }

    // Next, update the diff entries. We always update this, but may
    // combine it with the previous diff if it's been less than the
    // interval time
    let shouldCombine = false;
    if (history.entries.length === 1) {
        const topTime = history.entries[history.entries.length - 1].timestamp;
        if (currentTime - topTime < diffInterval()) {
            shouldCombine = true;
        }
    }
    else if (history.entries.length > 1) {
        const topTime = history.entries[history.entries.length - 1].timestamp;
        const prevTime = history.entries[history.entries.length - 2].timestamp;

        if (currentTime - topTime < diffInterval() && topTime - prevTime < diffInterval()) {
            shouldCombine = true;
        }
    }

    if (shouldCombine) {
        // Roll back the last diff and create a new one
        const prevEntry = history.entries.pop();
        const prevText = applyDiff(previousText, prevEntry, patch);

        const diffed = diffScriptText(prevText, toWrite, prevEntry.timestamp, diff);
        if (diffed) {
            history.entries.push(diffed);
        }
    }
    else {
        const diffed = diffScriptText(previousText, toWrite, history.lastSaveTime, diff);

        if (diffed) {
            history.entries.push(diffed);
        }
    }

    // also collapse diff history once per day
    if (collapseHistory && Math.floor(previousSaveTime / ONE_DAY) !== Math.floor(currentTime / ONE_DAY)) {
        history = collapseHistoryCore(
            history,
            toWrite,
            {
                interval: TWO_HOURS,
                maxTime: currentTime - ONE_DAY
            },
            diff,
            patch
        );
    }

    history.lastSaveTime = currentTime;

    // Finally, update the snapshots. These are failsafes in case something
    // goes wrong with the diff history. We keep one snapshot per interval for
    // the past 24 hours and one snapshot per day prior to that
    if (history.snapshots.length == 0) {
        history.snapshots.push(takeSnapshot(previousText, currentTime - 1));
    }
    else if (currentTime - history.snapshots[history.snapshots.length - 1].timestamp >= snapshotInterval()) {
        history.snapshots.push(takeSnapshot(previousText, currentTime));

        const trimmed: SnapshotEntry[] = [];
        let currentDay = Math.floor(currentTime / ONE_DAY) * ONE_DAY;

        for (let i = 0; i < history.snapshots.length; i++) {
            const current = history.snapshots[history.snapshots.length - 1 - i];
            if (currentTime - current.timestamp < ONE_DAY || i === history.snapshots.length - 1) {
                trimmed.unshift(current);
            }
            else if (current.timestamp < currentDay) {
                trimmed.unshift(current);
                currentDay = Math.floor(current.timestamp / ONE_DAY) * ONE_DAY;
            }
        }

        history.snapshots = trimmed;
    }

    // we previously had a bug where the history file was included in snapshots,
    // so delete those if they exist. they just blow up the file size
    for (const snapshot of history.snapshots) {
        if (snapshot.text[pxt.HISTORY_FILE]) {
            delete snapshot.text[pxt.HISTORY_FILE];
        }
    }

    toWrite[pxt.HISTORY_FILE] = JSON.stringify(history);
}

export function pushSnapshotOnHistory(text: ScriptText, currentTime: number) {
    let history: HistoryFile;

    if (text[pxt.HISTORY_FILE]) {
        history = parseHistoryFile(text[pxt.HISTORY_FILE]);
    }
    else {
        history = {
            entries: [],
            snapshots: [],
            shares: [],
            lastSaveTime: currentTime
        };
    }

    history.snapshots.push(takeSnapshot(text, currentTime));

    text[pxt.HISTORY_FILE] = JSON.stringify(history);
}

export function updateShareHistory(text: ScriptText, currentTime: number, shares: pxt.workspace.PublishVersion[]) {
    let history: HistoryFile;

    if (text[pxt.HISTORY_FILE]) {
        history = parseHistoryFile(text[pxt.HISTORY_FILE]);
    }
    else {
        history = {
            entries: [],
            snapshots: [],
            shares: [],
            lastSaveTime: currentTime
        };
    }

    for (const share of shares) {
        if (!history.shares.some(s => s.id === share.id)) {
            history.shares.push({
                id: share.id,
                timestamp: currentTime,
            });
        }
    }

    text[pxt.HISTORY_FILE] = JSON.stringify(history);
}

export function getTextAtTime(text: ScriptText, history: HistoryFile, time: number, patch: (p: unknown, text: string) => string) {
    let currentText = { ...text };

    for (let i = 0; i < history.entries.length; i++) {
        const index = history.entries.length - 1 - i;
        const entry = history.entries[index];
        currentText = applyDiff(currentText, entry, patch);
        if (entry.timestamp === time) {
            const version = index > 0 ? history.entries[index - 1].editorVersion : entry.editorVersion;
            return patchConfigEditorVersion(currentText, version)
        }
    }

    return { files: currentText, editorVersion: pxt.appTarget.versions.target };
}

export function patchConfigEditorVersion(text: ScriptText, editorVersion: string) {
    text = { ...text };

    // Attempt to update the version in pxt.json
    try {
        const config = JSON.parse(text[pxt.CONFIG_NAME]) as pxt.PackageConfig;
        if (config.targetVersions) {
            config.targetVersions.target = editorVersion;
        }
        text[pxt.CONFIG_NAME] = JSON.stringify(config, null, 4);
    }
    catch (e) {
    }

    return {
        files: text,
        editorVersion
    };
}

function takeSnapshot(text: ScriptText, time: number) {
    return {
        timestamp: time,
        editorVersion: pxt.appTarget.versions.target,
        text: createSnapshot(text)
    };
}

function scriptEquals(a: ScriptText, b: ScriptText) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);

    if (aKeys.length !== bKeys.length) return false;

    for (const key of aKeys) {
        if (bKeys.indexOf(key) === -1) return false;
        if (a[key] !== b[key]) return false;
    }

    return true;
}

function diffInterval() {
    if (pxt.appTarget?.appTheme?.timeMachineDiffInterval != undefined) {
        return pxt.appTarget.appTheme.timeMachineDiffInterval;
    }

    return DEFAULT_DIFF_HISTORY_INTERVAL;
}

function snapshotInterval() {
    if (pxt.appTarget?.appTheme?.timeMachineSnapshotInterval != undefined) {
        return pxt.appTarget.appTheme.timeMachineSnapshotInterval;
    }

    return DEFAULT_SNAPSHOT_HISTORY_INTERVAL;
}