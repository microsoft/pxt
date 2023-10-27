import { openDB, IDBPDatabase } from "idb";
import { isPersistentGameId } from "../Utils";

class KioskDb {
    db: IDBPDatabase | undefined;

    public async initializeAsync() {
        if (this.db) return;
        this.db = await openDB("kiosk", 1, {
            upgrade(db) {
                db.createObjectStore("builtjs");
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
            console.error(e);
        }
    }

    private async setAsync<T>(storeName: string, key: string, value: T): Promise<void> {
        if (!this.db) {
            throw new Error("IndexedDb not initialized.");
        }
        try {
            await this.db.put(storeName, value, key);
        } catch (e) {
            console.error(e);
        }
    }

    private async deleteAsync(storeName: string, key: string): Promise<void> {
        if (!this.db) {
            throw new Error("IndexedDb not initialized.");
        }
        try {
            await this.db.delete(storeName, key);
        } catch (e) {
            console.error(e);
        }
    }

    public async getBuiltJsInfoAsync(
        gameId: string
    ): Promise<pxtc.BuiltSimJsInfo | undefined> {
        const ver = pxt.appTarget?.versions?.target;
        if (!ver) return undefined;
        const key = `${ver}:${gameId}`;
        const rec = await this.getAsync<pxtc.BuiltSimJsInfo>("builtjs", key);
        return rec;
    }

    public async setBuiltJsInfoAsync(
        gameId: string,
        info: pxtc.BuiltSimJsInfo
    ): Promise<void> {
        const ver = pxt.appTarget?.versions?.target;
        if (!ver) return;
        if (isPersistentGameId(gameId)) return; // disallow keying to persistent-share gameIds (a safety measure. shouldn't happen in practice)
        const key = `${ver}:${gameId}`;
        await this.setAsync("builtjs", key, info);
    }
}

const db = new KioskDb();

let initializeAsync = async () => {
    initializeAsync = async () => {};
    await db.initializeAsync();
};

export async function getBuiltJsInfoAsync(
    gameId: string
): Promise<pxtc.BuiltSimJsInfo | undefined> {
    await initializeAsync();
    return await db.getBuiltJsInfoAsync(gameId);
}

export async function setBuiltJsInfoAsync(
    gameId: string,
    info: pxtc.BuiltSimJsInfo
): Promise<void> {
    await initializeAsync();
    await db.setBuiltJsInfoAsync(gameId, info);
}
