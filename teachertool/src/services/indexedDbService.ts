import { openDB, IDBPDatabase } from "idb";
import { ErrorCode } from "../types/errorCode";
import { logError } from "./loggingService";
import { Rubric } from "../types/rubric";

const teacherToolDbName = "makecode-project-insights";
const dbVersion = 1;
const rubricsStoreName = "rubrics";
const metadataStoreName = "metadata";
const metadataKeys = {
    lastActiveRubricKey: "lastActiveRubricName",
};

type MetadataEntry = { key: string; value: any };

class TeacherToolDb {
    db: IDBPDatabase | undefined;

    public async initializeAsync() {
        if (this.db) return;
        this.db = await openDB(teacherToolDbName, dbVersion, {
            upgrade(db) {
                db.createObjectStore(rubricsStoreName, { keyPath: "name" });
                db.createObjectStore(metadataStoreName, { keyPath: "key" });
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

    private async getMetadataEntryAsync(key: string): Promise<MetadataEntry | undefined> {
        return this.getAsync<MetadataEntry>(metadataStoreName, key);
    }

    private async setMetadataEntryAsync(key: string, value: any): Promise<void> {
        return this.setAsync<MetadataEntry>(metadataStoreName, { key, value });
    }

    private async deleteMetadataEntryAsync(key: string): Promise<void> {
        return this.deleteAsync(metadataStoreName, key);
    }

    public async getLastActiveRubricNameAsync(): Promise<string | undefined> {
        const metadataEntry = await this.getMetadataEntryAsync(metadataKeys.lastActiveRubricKey);
        return metadataEntry?.value;
    }

    public saveLastActiveRubricNameAsync(name: string): Promise<void> {
        return this.setMetadataEntryAsync(metadataKeys.lastActiveRubricKey, name);
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

const db = new TeacherToolDb();

let initializeAsync = async () => {
    initializeAsync = async () => {}; // Ensure future initializeAsync calls are no-ops.

    await db.initializeAsync();
};

export async function getLastActiveRubricAsync(): Promise<Rubric | undefined> {
    await initializeAsync();

    let rubric: Rubric | undefined = undefined;
    const name = await db.getLastActiveRubricNameAsync();
    if (name) {
        rubric = await db.getRubric(name);
    }

    return rubric;
}

export async function saveRubricAsync(rubric: Rubric) {
    await db.saveRubric(rubric);
    await db.saveLastActiveRubricNameAsync(rubric.name);
}

export async function deleteRubricAsync(name: string) {
    await db.deleteRubric(name);
}
