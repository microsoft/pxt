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
    listAsync(namespace: string): Promise<BackpackLocalRecord[]>;
    /** Clear guest and pending account records for this target only. */
    clearAsync(targetId: string): Promise<void>;
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

const DB_NAME = "pxt-backpack";
const ITEMS = "items";
const NAMESPACE_INDEX = "namespace";

/** Which part of a local backpack operation failed, so the message (and telemetry) can tell them apart. */
type StorageStep = "open" | "read" | "write";

function storageError(step: StorageStep, cause?: unknown): Error {
    // Only the DOMException name is reported; messages can carry details we don't want in telemetry.
    const name = cause && typeof (cause as { name?: unknown }).name === "string" ? (cause as { name: string }).name : "unknown";
    try {
        pxt.tickEvent("backpack.storage.error", { step, error: name });
    } catch {
        /* Telemetry must not replace the storage error. */
    }
    switch (step) {
        case "open":
            return new BackpackUserError(lf("Could not open your local backpack. Allow browser storage, then try again."));
        case "read":
            return new BackpackUserError(lf("Could not load your local backpack. Allow browser storage, then try again."));
        default:
            return new BackpackUserError(lf("Could not save to your local backpack. Check available space, then try again."));
    }
}

function requireItemsKeyPath(store: IDBObjectStore): void {
    const keyPath = store.keyPath;
    if (!Array.isArray(keyPath) || keyPath.length !== 2 || keyPath[0] !== "namespace" || keyPath[1] !== "key") {
        throw new DOMException("Unsupported backpack items key path", "NotSupportedError");
    }
}

function hasNamespaceIndex(store: IDBObjectStore): boolean {
    if (!store.indexNames.contains(NAMESPACE_INDEX)) return false;
    const index = store.index(NAMESPACE_INDEX);
    return index.keyPath === NAMESPACE_INDEX && !index.unique;
}

/** Repair the schema without discarding existing backpack records. */
function upgradeSchema(db: IDBDatabase, transaction: IDBTransaction): void {
    const store = db.objectStoreNames.contains(ITEMS)
        ? transaction.objectStore(ITEMS)
        : db.createObjectStore(ITEMS, { keyPath: ["namespace", "key"] });
    requireItemsKeyPath(store);
    if (hasNamespaceIndex(store)) return;
    if (store.indexNames.contains(NAMESPACE_INDEX)) store.deleteIndex(NAMESPACE_INDEX);
    store.createIndex(NAMESPACE_INDEX, NAMESPACE_INDEX, { unique: false });
}

function hasSchema(db: IDBDatabase): boolean {
    if (!db.objectStoreNames.contains(ITEMS)) return false;
    const store = db.transaction(ITEMS, "readonly").objectStore(ITEMS);
    requireItemsKeyPath(store);
    return hasNamespaceIndex(store);
}

/** Report IndexedDB failures instead of falling back to storage that may lose pending uploads. */
export function createBackpackLocalStorage(factory: IDBFactory): BackpackLocalStorage {
    const requestAsync = (version?: number): Promise<IDBDatabase> => new Promise((resolve, reject) => {
        let request: IDBOpenDBRequest;
        let upgradeFailure: unknown;
        try {
            request = version === undefined ? factory.open(DB_NAME) : factory.open(DB_NAME, version);
        } catch (error) {
            reject(storageError("open", error));
            return;
        }

        request.onupgradeneeded = () => {
            try {
                upgradeSchema(request.result, request.transaction);
            } catch (error) {
                upgradeFailure = error;
                request.transaction.abort();
            }
        };
        request.onerror = () => reject(storageError("open", upgradeFailure || request.error));
        // A blocked upgrade waits for other connections to close, which they do on versionchange; like the project
        // store, keep waiting for success or error instead of failing.
        request.onsuccess = () => {
            const db = request.result;
            db.onversionchange = () => db.close();
            resolve(db);
        };
    });

    // Opens whatever version exists, so a database left by a newer or older build still works as long as its items
    // store does. Anything missing is added with a one-step upgrade.
    const openAsync = async (): Promise<IDBDatabase> => {
        const db = await requestAsync();
        let usable: boolean;
        try {
            usable = hasSchema(db);
        } catch (error) {
            db.close();
            throw storageError("open", error);
        }
        if (usable) return db;

        const version = db.version + 1;
        db.close();
        const upgraded = await requestAsync(version);
        try {
            if (hasSchema(upgraded)) return upgraded;
        } catch (error) {
            upgraded.close();
            throw storageError("open", error);
        }
        upgraded.close();
        throw storageError("open", { name: "MissingStore" });
    };

    const transactionAsync = async <T>(
        mode: IDBTransactionMode,
        action: (store: IDBObjectStore, result: (value: T) => void, abort: (error: unknown) => void) => void
    ): Promise<T> => {
        const step: StorageStep = mode === "readonly" ? "read" : "write";
        const db = await openAsync();
        try {
            return await new Promise<T>((resolve, reject) => {
                let transaction: IDBTransaction;
                let result: T;
                let settled = false;
                let abortCause: unknown;
                // A failed request fires error and then abort; report it once.
                const fail = (error: unknown) => {
                    if (settled) return;
                    settled = true;
                    reject(storageError(step, error));
                };
                const abort = (error: unknown) => {
                    abortCause = error;
                    try {
                        if (transaction) {
                            transaction.abort();
                            return;
                        }
                    } catch {
                        /* Already completed. */
                    }
                    fail(error);
                };
                try {
                    transaction = db.transaction(ITEMS, mode);
                    transaction.oncomplete = () => {
                        settled = true;
                        resolve(result);
                    };
                    transaction.onerror = event => fail(abortCause ?? transaction.error ?? (event.target as IDBRequest)?.error);
                    transaction.onabort = () => fail(abortCause ?? transaction.error ?? { name: "AbortError" });
                    action(transaction.objectStore(ITEMS), value => {
                        result = value;
                    }, abort);
                } catch (error) {
                    abort(error);
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
        clearAsync: targetId => transactionAsync<void>("readwrite", (store, done) => {
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
        changeAsync: (namespace, key, expected, next) => transactionAsync<boolean>("readwrite", (store, done, abort) => {
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
                } catch (error) {
                    abort(error);
                }
            };
        })
    };
}