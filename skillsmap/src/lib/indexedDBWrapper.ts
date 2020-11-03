// Duplicated from pxtlib/browserutils.ts
// TODO: Move to common location


// IndexedDB wrapper class
export type IDBUpgradeHandler = (ev: IDBVersionChangeEvent, request: IDBRequest) => void;

export class IDBWrapper {
    private _db!: IDBDatabase;

    constructor(
        private name: string,
        private version: number,
        private upgradeHandler?: IDBUpgradeHandler,
        private quotaExceededHandler?: () => void) {
    }

    private throwIfNotOpened(): void {
        if (!this._db) {
            throw new Error("Database not opened; call IDBWrapper.openAsync() first");
        }
    }

    private errorHandler(err: Error, op: string, reject: (err: Error) => void): void {
        console.error(new Error(`${this.name} IDBWrapper error for ${op}: ${err.message}`));
        reject(err);
        // special case for quota exceeded
        if (err.name == "QuotaExceededError") {
            // oops, we ran out of space
            pxt.log(`storage quota exceeded...`);
            pxt.tickEvent('storage.quotaexceedederror');
            if (this.quotaExceededHandler)
                this.quotaExceededHandler();
        }
    }

    private getObjectStore(name: string, mode: "readonly" | "readwrite" = "readonly"): IDBObjectStore {
        this.throwIfNotOpened();
        const transaction = this._db.transaction([name], mode);
        return transaction.objectStore(name);
    }

    static deleteDatabaseAsync(name: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const idbFactory: IDBFactory = window.indexedDB || (<any>window).mozIndexedDB || (<any>window).webkitIndexedDB || (<any>window).msIndexedDB;
            const request = idbFactory.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    public openAsync(): Promise<void> {
        return new Promise((resolve, reject) => {
            const idbFactory: IDBFactory = window.indexedDB || (<any>window).mozIndexedDB || (<any>window).webkitIndexedDB || (<any>window).msIndexedDB;
            const request = idbFactory.open(this.name, this.version);
            request.onsuccess = () => {
                this._db = request.result;
                resolve();
            };
            request.onerror = () => this.errorHandler(request.error!, "open", reject);
            request.onupgradeneeded = (ev) => this.upgradeHandler && this.upgradeHandler(ev, request);
        });
    }

    public getAsync<T>(storeName: string, id: string): Promise<T> {
        return new Promise((resolve, reject) => {
            const store = this.getObjectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result as T);
            request.onerror = () => this.errorHandler(request.error!, "get", reject);
        });
    }

    public getAllAsync<T>(storeName: string): Promise<T[]> {
        return new Promise((resolve, reject) => {
            const store = this.getObjectStore(storeName);
            const cursor = store.openCursor();
            const data: T[] = [];

            cursor.onsuccess = () => {
                if (cursor.result) {
                    data.push(cursor.result.value);
                    cursor.result.continue();
                } else {
                    resolve(data);
                }
            };
            cursor.onerror = () => this.errorHandler(cursor.error!, "getAll", reject);
        });
    }

    public setAsync(storeName: string, data: any): Promise<void> {
        return new Promise((resolve, reject) => {
            const store = this.getObjectStore(storeName, "readwrite");
            let request: IDBRequest;

            if (typeof data.id !== "undefined" && data.id !== null) {
                request = store.put(data);
            } else {
                request = store.add(data);
            }

            request.onsuccess = () => resolve();
            request.onerror = () => this.errorHandler(request.error!, "set", reject);
        });
    }

    public deleteAsync(storeName: string, id: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const store = this.getObjectStore(storeName, "readwrite");
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => this.errorHandler(request.error!, "delete", reject);
        });
    }

    public deleteAllAsync(storeName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const store = this.getObjectStore(storeName, "readwrite");
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => this.errorHandler(request.error!, "deleteAll", reject);
        });
    }
}