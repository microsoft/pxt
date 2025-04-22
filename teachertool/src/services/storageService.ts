import { openDB, IDBPDatabase } from "idb";
import { ErrorCode } from "../types/errorCode";
import { logError } from "./loggingService";
import { Checklist } from "../types/checklist";

// ----------------------------------
// Local Storage (for simple key -> value mappings of small data)
// ----------------------------------

const KEY_PREFIX = "teachertool";
const RUN_ON_LOAD_KEY = [KEY_PREFIX, "runOnLoad"].join("/");
const LAST_ACTIVE_CHECKLIST_KEY = [KEY_PREFIX, "lastActiveChecklist"].join("/");
const SPLIT_POSITION_KEY = [KEY_PREFIX, "splitPosition"].join("/");
const EXPANDED_CATALOG_TAGS_KEY = [KEY_PREFIX, "expandedCatalogTags"].join("/");
const BLOCK_AS_TEXT_PREFIX = [KEY_PREFIX, "blockAsText"].join("/");

function getValue(key: string, defaultValue?: string): string | undefined {
    return localStorage.getItem(key) || defaultValue;
}

function setValue(key: string, val: string) {
    localStorage.setItem(key, val);
}

function delValue(key: string) {
    localStorage.removeItem(key);
}

// ----------------------------------
// Indexed DB (for storing larger, structured data)
// ----------------------------------

const teacherToolDbName = "makecode-project-insights";
const dbVersion = 2;
const checklistsStoreName = "checklists";

class TeacherToolDb {
    db: IDBPDatabase | undefined;

    public async initializeAsync() {
        if (this.db) return;
        this.db = await openDB(teacherToolDbName, dbVersion, {
            upgrade(db) {
                db.createObjectStore(checklistsStoreName, { keyPath: "name" });
            },
        });
    }

    private async getAsync<T>(storeName: string, key: string): Promise<T | undefined> {
        if (!this.db) {
            throw new Error("IndexedDb not initialized.");
        }

        try {
            return await this.db.get(storeName, key);
        } catch (e) {
            // Not recording key, as it could contain user-input with sensitive information.
            logError(ErrorCode.unableToGetIndexedDbRecord, e);
        }
    }

    private async setAsync<T>(storeName: string, value: T): Promise<void> {
        if (!this.db) {
            throw new Error("IndexedDb not initialized.");
        }

        try {
            await this.db.put(storeName, value);
        } catch (e) {
            // Not recording key, as it could contain user-input with sensitive information.
            logError(ErrorCode.unableToSetIndexedDbRecord, e);
        }
    }

    private async deleteAsync(storeName: string, key: string): Promise<void> {
        if (!this.db) {
            throw new Error("IndexedDb not initialized.");
        }
        try {
            await this.db.delete(storeName, key);
        } catch (e) {
            // Not recording key, as it could contain user-input with sensitive information.
            logError(ErrorCode.unableToDeleteIndexedDbRecord, e);
        }
    }

    public getChecklist(name: string): Promise<Checklist | undefined> {
        return this.getAsync<Checklist>(checklistsStoreName, name);
    }

    public saveChecklist(checklist: Checklist): Promise<void> {
        return this.setAsync(checklistsStoreName, checklist);
    }

    public deleteChecklist(name: string): Promise<void> {
        return this.deleteAsync(checklistsStoreName, name);
    }
}

const getDb = (async () => {
    const db = new TeacherToolDb();
    await db.initializeAsync();
    return db;
})();

async function saveChecklistToIndexedDbAsync(checklist: Checklist) {
    const db = await getDb;
    await db.saveChecklist(checklist);
}

async function deleteChecklistFromIndexedDbAsync(name: string) {
    const db = await getDb;
    await db.deleteChecklist(name);
}

function getBlockAsTextKey(blockId: string): string {
    return [BLOCK_AS_TEXT_PREFIX, blockId].join("/");
}

// ----------------------------------
// Exports
// ----------------------------------

export function getRunOnLoad(): boolean {
    try {
        return getValue(RUN_ON_LOAD_KEY, "false") === "true";
    } catch (e) {
        logError(ErrorCode.localStorageReadError, e);
        return false;
    }
}

export function setRunOnLoad(runOnLoad: boolean) {
    try {
        setValue(RUN_ON_LOAD_KEY, runOnLoad.toString());
    } catch (e) {
        logError(ErrorCode.localStorageWriteError, e);
    }
}

export function getLastActiveChecklistName(): string {
    try {
        return getValue(LAST_ACTIVE_CHECKLIST_KEY) ?? "";
    } catch (e) {
        logError(ErrorCode.localStorageReadError, e);
        return "";
    }
}

export function setLastActiveChecklistName(name: string) {
    try {
        setValue(LAST_ACTIVE_CHECKLIST_KEY, name);
    } catch (e) {
        logError(ErrorCode.localStorageWriteError, e);
    }
}

export function getLastSplitPosition(): string {
    try {
        return getValue(SPLIT_POSITION_KEY) ?? "";
    } catch (e) {
        logError(ErrorCode.localStorageReadError, e);
        return "";
    }
}

export function setLastSplitPosition(position: string) {
    try {
        setValue(SPLIT_POSITION_KEY, position);
    } catch (e) {
        logError(ErrorCode.localStorageWriteError, e);
    }
}

export async function getChecklist(name: string): Promise<Checklist | undefined> {
    const db = await getDb;

    let checklist: Checklist | undefined = undefined;
    checklist = await db.getChecklist(name);

    return checklist;
}

export async function getLastActiveChecklistAsync(): Promise<Checklist | undefined> {
    const lastActiveChecklistName = getLastActiveChecklistName();
    return await getChecklist(lastActiveChecklistName);
}

export async function saveChecklistAsync(checklist: Checklist) {
    await saveChecklistToIndexedDbAsync(checklist);
    setLastActiveChecklistName(checklist.name);
}

export async function deleteChecklistAsync(name: string) {
    await deleteChecklistFromIndexedDbAsync(name);

    if (getLastActiveChecklistName() === name) {
        setLastActiveChecklistName("");
    }
}

// Returns undefined if it has not been set or if there was an issue.
// Empty list means it was explicitly set to empty.
export function getExpandedCatalogTags(): string[] | undefined {
    try {
        const tags = getValue(EXPANDED_CATALOG_TAGS_KEY);
        return tags ? JSON.parse(tags) : undefined;
    } catch (e) {
        logError(ErrorCode.localStorageReadError, e);
        return undefined;
    }
}

export function setExpandedCatalogTags(tags: string[]) {
    try {
        setValue(EXPANDED_CATALOG_TAGS_KEY, JSON.stringify(tags));
    } catch (e) {
        logError(ErrorCode.localStorageWriteError, e);
    }
}

export function addExpandedCatalogTag(tag: string) {
    let expandedTags = getExpandedCatalogTags();
    if (!expandedTags) {
        expandedTags = [];
    }
    expandedTags.push(tag);
    setExpandedCatalogTags(expandedTags);
}

export function removeExpandedCatalogTag(tag: string) {
    let expandedTags = getExpandedCatalogTags();
    if (!expandedTags) {
        setExpandedCatalogTags([]);
    } else {
        const index = expandedTags.indexOf(tag);
        if (index !== -1) {
            expandedTags.splice(index, 1);
            setExpandedCatalogTags(expandedTags);
        }
    }
}

export function getCachedBlockAsText(blockId: string): pxt.editor.BlockAsText | undefined {
    const key = getBlockAsTextKey(blockId);
    try {
        const cachedReadableBlockName = getValue(key);
        return cachedReadableBlockName ? JSON.parse(cachedReadableBlockName) : undefined;
    } catch (e) {
        logError(ErrorCode.localStorageReadError, e);
        return undefined;
    }
}

export function cacheBlockAsText(blockId: string, readableBlockName: pxt.editor.BlockAsText) {
    const key = getBlockAsTextKey(blockId);
    try {
        setValue(key, JSON.stringify(readableBlockName));
    } catch (e) {
        logError(ErrorCode.localStorageWriteError, e);
    }
}
