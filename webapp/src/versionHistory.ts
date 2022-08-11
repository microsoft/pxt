import * as diff from "diff";

export function pushHistoryEntry(oldVersion: pxt.workspace.ScriptText, newVersion: pxt.workspace.ScriptText, history: pxt.workspace.HistoryEntry[]) {
    if (!oldVersion || !newVersion) return history.slice();

    const newHistory = history.slice();
    const diffEntry = diffScriptText(oldVersion, newVersion);
    if (!diffEntry) return newHistory;

    const prevEntry = newHistory[newHistory.length - 1];

    // If this change is completely separate from the previous change and they both happened
    // recently, combine them instead of pushing a new entry. A lot of the time we save changes
    // to files one at a time so this helps to keep the history from ballooning
    if (prevEntry && canCombine(prevEntry, diffEntry)) {
        newHistory.pop();
        for (const change of prevEntry.changes) {
            diffEntry.changes.push(change);
        }
    }

    newHistory.push(diffEntry);
    return newHistory;
}



export function diffScriptText(oldVersion: pxt.workspace.ScriptText, newVersion: pxt.workspace.ScriptText): pxt.workspace.HistoryEntry {
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
                diff: diff.createPatch(file, newVersion[file], oldVersion[file])
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

export function applyDiff(text: pxt.workspace.ScriptText, diffEntry: pxt.workspace.HistoryEntry) {
    for (const change of diffEntry.changes) {
        if (change.type === "added") {
            delete text[change.filename]
        }
        else if (change.type === "removed") {
            text[change.filename] = change.value;
        }
        else {
            text[change.filename] = diff.applyPatch(text[change.filename], change.diff);
        }
    }

    return text;
}

export function getScriptAtTime(text: pxt.workspace.ScriptText, history: pxt.workspace.HistoryEntry[], time: number) {
    let currentText = {
        ...text
    };

    for (let i = 0; i < history.length; i++) {
        const entry = history[history.length - 1 - i];
        if (entry.timestamp <= time) break;
        currentText = applyDiff(currentText, entry);
    }

    return currentText;
}


export function squashHistory(text: pxt.workspace.ScriptText, history: pxt.workspace.HistoryEntry[], startTime: number, endTime: number) {
    const newDiff = diffScriptText(getScriptAtTime(text, history, startTime), getScriptAtTime(text, history, endTime));
    if (newDiff.changes.length === 0) return history;

    newDiff.timestamp = endTime;

    const before = history.filter(entry => entry.timestamp < startTime);
    const after = history.filter(entry => entry.timestamp > endTime);


    return before.concat([newDiff]).concat(after);
}

function canCombine(oldEntry: pxt.workspace.HistoryEntry, newEntry: pxt.workspace.HistoryEntry) {
    // Always push a new entry after a certain amount of time
    if (newEntry.timestamp - oldEntry.timestamp > 3000) return false;

    // Check to see if they touch any of the same files
    let fileNames: pxt.Map<boolean> = {};

    for (const change of oldEntry.changes) {
        fileNames[change.filename] = true;
    }

    for (const change of newEntry.changes) {
        if (fileNames[change.filename]) return false;
    }
    return true;
}