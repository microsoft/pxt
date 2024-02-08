import { openDB, IDBPDatabase } from "idb";
import { ErrorCode } from "../types/errorCode";
import { logError } from "./loggingService";
import { Rubric } from "../types/rubric";

const teacherToolDbName = "makecode-project-insights";
const dbVersion = 1;
const rubricsStoreName = "rubrics";

type MetadataEntry = { key: string; value: any };

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

export async function getRubricFromIndexedDbAsync(name: string): Promise<Rubric | undefined> {
    const db = await getDb;

    let rubric: Rubric | undefined = undefined;
    if (name) {
        rubric = await db.getRubric(name);
    }

    return rubric;
}

export async function saveRubricToIndexedDbAsync(rubric: Rubric) {
    const db = await getDb;
    await db.saveRubric(rubric);
}

export async function deleteRubricFromIndexedDbAsync(name: string) {
    const db = await getDb;
    await db.deleteRubric(name);
}
