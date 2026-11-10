import { BackpackUserError } from "./errors";

/** IndexedDB records use the namespace and key together as their primary key. */
export interface BackpackLocalRecord {
    namespace: string;
    key: string;
    payload: string;
    /** Claim guest uploads before sending so a different account cannot retry them. */
    owner?: string;
    firstAttemptAt?: number;
}

export interface BackpackLocalStorage {
    /** Capture before preparing a write; changeAsync checks it in the write transaction. */
    resetEpochAsync(targetId: string): Promise<number>;
    listAsync(namespace: string): Promise<BackpackLocalRecord[]>;
    /** Clear guest and pending account records for this target only. */
    clearAsync(targetId: string): Promise<void>;
    /** Write only if the stored record matches expected; undefined requires an absent key. */
    changeAsync(
        namespace: string,
        key: string,
        expected: BackpackLocalRecord | undefined,
        next: BackpackLocalRecord | undefined,
        resetEpoch: number
    ): Promise<boolean>;
}

export function backpackLocalNamespace(target: string, userId?: string): string {
    return JSON.stringify([target, userId === undefined ? "guest" : "user", userId || ""]);
}

function storageError(): Error {
    return new BackpackUserError(lf("Could not save or read your local backpack. Allow browser storage and check available space, then try again."));
}

/** Report IndexedDB failures instead of falling back to storage that may lose pending uploads. */
export function createBackpackLocalStorage(factory: IDBFactory): BackpackLocalStorage {
    const openAsync = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
        let request: IDBOpenDBRequest;
        let failed = false;
        try {
            request = factory.open("pxt-backpack", 2);
        } catch {
            reject(storageError());
            return;
        }

        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains("items")) {
                const store = request.result.createObjectStore("items", { keyPath: ["namespace", "key"] });
                store.createIndex("namespace", "namespace", { unique: false });
            }
            if (!request.result.objectStoreNames.contains("resets")) request.result.createObjectStore("resets");
        };
        request.onerror = request.onblocked = () => {
            failed = true;
            reject(storageError());
        };
        request.onsuccess = () => {
            if (failed) {
                request.result.close();
                return;
            }
            request.result.onversionchange = () => request.result.close();
            resolve(request.result);
        };
    });

    const transactionAsync = async <T>(
        mode: IDBTransactionMode,
        action: (store: IDBObjectStore, resets: IDBObjectStore, result: (value: T) => void) => void
    ): Promise<T> => {
        const db = await openAsync();
        try {
            return await new Promise<T>((resolve, reject) => {
                let transaction: IDBTransaction;
                let result: T;
                try {
                    // The optional third argument is ignored by older implementations.
                    const begin = db.transaction as (
                        name: string[],
                        mode: IDBTransactionMode,
                        options?: { durability: "strict" }
                    ) => IDBTransaction;
                    transaction = begin.call(db, ["items", "resets"], mode, { durability: "strict" });
                    transaction.oncomplete = () => resolve(result);
                    transaction.onerror = transaction.onabort = () => reject(storageError());
                    action(transaction.objectStore("items"), transaction.objectStore("resets"), value => {
                        result = value;
                    });
                } catch {
                    try {
                        transaction?.abort();
                    } catch {
                        /* Already completed. */
                    }
                    reject(storageError());
                }
            });
        } finally {
            db.close();
        }
    };

    return {
        resetEpochAsync: targetId => transactionAsync<number>("readonly", (_store, resets, done) => {
            const request = resets.get(targetId);
            request.onsuccess = () => done(request.result || 0);
        }),
        listAsync: namespace => transactionAsync<BackpackLocalRecord[]>("readonly", (store, _resets, done) => {
            const request = store.index("namespace").getAll(namespace);
            request.onsuccess = () => done(request.result);
        }),
        clearAsync: targetId => transactionAsync<void>("readwrite", (store, resets, done) => {
            const epoch = resets.get(targetId);
            epoch.onsuccess = () => resets.put((epoch.result || 0) + 1, targetId);
            const prefix = JSON.stringify([targetId]).slice(0, -1) + ",";
            const request = store.openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) {
                    done(undefined);
                    return;
                }
                if ((cursor.primaryKey as string[])[0].startsWith(prefix)) cursor.delete();
                cursor.continue();
            };
        }),
        changeAsync: (namespace, key, expected, next, resetEpoch) => transactionAsync<boolean>("readwrite", (store, resets, done) => {
            const epoch = resets.get(JSON.parse(namespace)[0]);
            epoch.onsuccess = () => {
                if ((epoch.result || 0) !== resetEpoch) {
                    done(false);
                    return;
                }
                const request = store.get([namespace, key]);
                request.onsuccess = () => {
                    try {
                        const current: BackpackLocalRecord = request.result;
                        const same = !current ? !expected : !!expected && current.payload === expected.payload
                            && current.owner === expected.owner && current.firstAttemptAt === expected.firstAttemptAt;
                        if (!same) {
                            done(false);
                            return;
                        }
                        if (next) store.put({ ...next, namespace, key });
                        else store.delete([namespace, key]);
                        done(true);
                    } catch {
                        store.transaction.abort();
                    }
                };
            };
        })
    };
}