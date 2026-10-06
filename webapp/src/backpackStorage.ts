import { BackpackUserError } from "./backpackErrors";

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
    listAsync(namespace: string): Promise<BackpackLocalRecord[]>;
    /** Write only if the stored record matches expected; undefined requires an absent key. */
    changeAsync(
        namespace: string,
        key: string,
        expected: BackpackLocalRecord | undefined,
        next: BackpackLocalRecord | undefined
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
            request = factory.open("pxt-backpack", 1);
        } catch {
            reject(storageError());
            return;
        }

        request.onupgradeneeded = () => {
            const store = request.result.createObjectStore("items", { keyPath: ["namespace", "key"] });
            store.createIndex("namespace", "namespace", { unique: false });
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
        action: (store: IDBObjectStore, result: (value: T) => void) => void
    ): Promise<T> => {
        const db = await openAsync();
        try {
            return await new Promise<T>((resolve, reject) => {
                let transaction: IDBTransaction;
                let result: T;
                try {
                    // The optional third argument is ignored by older implementations.
                    const begin = db.transaction as (
                        name: string,
                        mode: IDBTransactionMode,
                        options?: { durability: "strict" }
                    ) => IDBTransaction;
                    transaction = begin.call(db, "items", mode, { durability: "strict" });
                    transaction.oncomplete = () => resolve(result);
                    transaction.onerror = transaction.onabort = () => reject(storageError());
                    action(transaction.objectStore("items"), value => {
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
        listAsync: namespace => transactionAsync<BackpackLocalRecord[]>("readonly", (store, done) => {
            const request = store.index("namespace").getAll(namespace);
            request.onsuccess = () => done(request.result);
        }),
        changeAsync: (namespace, key, expected, next) => transactionAsync<boolean>("readwrite", (store, done) => {
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
        })
    };
}