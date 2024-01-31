import { openDB, IDBPDatabase } from "idb";
import { ErrorCode } from "../types/errorCode";
import { logError } from "./loggingService";
import { CriteriaInstance } from "../types/criteria";
import { Rubric } from "../types/rubric";

const teacherToolDbName = "makecode-project-insights";
const dbVersion = 1;
const rubricsStoreName = "rubrics";
const lastActiveRubricKey = "_lastActiveRubricName";

class TeacherToolDb {
    db: IDBPDatabase | undefined;

    public async initializeAsync() {
        if (this.db) return;
        this.db = await openDB(teacherToolDbName, dbVersion, {
            upgrade(db) {
                db.createObjectStore(rubricsStoreName);
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

    private async setAsync<T>(storeName: string, key: string, value: T): Promise<void> {
        if (!this.db) {
            throw new Error("IndexedDb not initialized.");
        }

        try {
            await this.db.put(storeName, value, key);
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

    public getLastActiveRubricNameAsync(): Promise<string | undefined> {
        return this.getAsync<string>(rubricsStoreName, lastActiveRubricKey);
    }

    public saveLastActiveRubricNameAsync(name: string): Promise<void> {
        return this.setAsync<string>(rubricsStoreName, lastActiveRubricKey, name);
    }

    public getRubric(name: string): Promise<Rubric | undefined> {
        return this.getAsync<Rubric>(rubricsStoreName, name);
    }

    public saveRubric(rubric: Rubric): Promise<void> {
        return this.setAsync(rubricsStoreName, rubric.name, rubric);
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

export async function saveRubric(rubric: Rubric) {
    await db.saveRubric(rubric);
    await db.saveLastActiveRubricNameAsync(rubric.name);
}

export async function deleteRubric(name: string) {
    await db.deleteRubric(name);
}
