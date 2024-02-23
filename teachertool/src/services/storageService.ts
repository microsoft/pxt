import { openDB, IDBPDatabase } from "idb";
import { ErrorCode } from "../types/errorCode";
import { logError } from "./loggingService";
import { Rubric } from "../types/rubric";

// ----------------------------------
// Local Storage (for simple key -> value mappings of small data)
// ----------------------------------

const KEY_PREFIX = "teachertool";
const AUTORUN_KEY = [KEY_PREFIX, "autorun"].join("/");
const LAST_ACTIVE_RUBRIC_KEY = [KEY_PREFIX, "lastActiveRubric"].join("/");
const SPLIT_POSITION_KEY = [KEY_PREFIX, "splitPosition"].join("/");

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
const dbVersion = 1;
const rubricsStoreName = "rubrics";

class TeacherToolDb {
    db: IDBPDatabase | undefined;

    public async initializeAsync() {
        if (this.db) return;
        this.db = await openDB(teacherToolDbName, dbVersion, {
            upgrade(db) {
                db.createObjectStore(rubricsStoreName, { keyPath: "name" });
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

    public getRubric(name: string): Promise<Rubric | undefined> {
        return this.getAsync<Rubric>(rubricsStoreName, name);
    }

    public saveRubric(rubric: Rubric): Promise<void> {
        return this.setAsync(rubricsStoreName, rubric);
    }

    public deleteRubric(name: string): Promise<void> {
        return this.deleteAsync(rubricsStoreName, name);
    }
}

const getDb = (async () => {
    const db = new TeacherToolDb();
    await db.initializeAsync();
    return db;
})();

async function saveRubricToIndexedDbAsync(rubric: Rubric) {
    const db = await getDb;
    await db.saveRubric(rubric);
}

async function deleteRubricFromIndexedDbAsync(name: string) {
    const db = await getDb;
    await db.deleteRubric(name);
}

// ----------------------------------
// Exports
// ----------------------------------

export function getAutorun(): boolean {
    try {
        return getValue(AUTORUN_KEY, "false") === "true";
    } catch (e) {
        logError(ErrorCode.localStorageReadError, e);
        return false;
    }
}

export function setAutorun(autorun: boolean) {
    try {
        setValue(AUTORUN_KEY, autorun.toString());
    } catch (e) {
        logError(ErrorCode.localStorageWriteError, e);
    }
}

export function getLastActiveRubricName(): string {
    try {
        return getValue(LAST_ACTIVE_RUBRIC_KEY) ?? "";
    } catch (e) {
        logError(ErrorCode.localStorageReadError, e);
        return "";
    }
}

export function setLastActiveRubricName(name: string) {
    try {
        setValue(LAST_ACTIVE_RUBRIC_KEY, name);
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

export async function getRubric(name: string): Promise<Rubric | undefined> {
    const db = await getDb;

    let rubric: Rubric | undefined = undefined;
    rubric = await db.getRubric(name);

    return rubric;
}

export async function getLastActiveRubricAsync(): Promise<Rubric | undefined> {
    const lastActiveRubricName = getLastActiveRubricName();
    return await getRubric(lastActiveRubricName);
}

export async function saveRubricAsync(rubric: Rubric) {
    await saveRubricToIndexedDbAsync(rubric);
    setLastActiveRubricName(rubric.name);
}

export async function deleteRubricAsync(name: string) {
    await deleteRubricFromIndexedDbAsync(name);

    if (getLastActiveRubricName() === name) {
        setLastActiveRubricName("");
    }
}
