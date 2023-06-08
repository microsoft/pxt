namespace pxt.storage {
    interface IStorage {
        removeItem(key: string): void;
        getItem(key: string): string;
        setItem(key: string, value: string): void;
        clear(): void;
    }

    class MemoryStorage implements IStorage {
        type: "memory";
        items: pxt.Map<string> = {};

        removeItem(key: string) {
            delete this.items[key];
        }
        getItem(key: string): string {
            return this.items[key];
        }
        setItem(key: string, value: string): void {
            this.items[key] = value;
        }
        clear() {
            this.items = {};
        }
    }

    class LocalStorage implements IStorage {
        type = "localstorage";

        constructor(private storageId: string) {
        }

        targetKey(key: string): string {
            return this.storageId + '/' + key;
        }

        removeItem(key: string) {
            window.localStorage.removeItem(this.targetKey(key));
        }
        getItem(key: string): string {
            return window.localStorage[this.targetKey(key)];
        }
        setItem(key: string, value: string): void {
            window.localStorage[this.targetKey(key)] = value;
        }
        clear() {
            let prefix = this.targetKey('');
            let keys: string[] = [];
            for (let i = 0; i < window.localStorage.length; ++i) {
                let key = window.localStorage.key(i);
                if (key.indexOf(prefix) == 0)
                    keys.push(key);
            }
            keys.forEach(key => window.localStorage.removeItem(key));
        }
    }

    export function storageId(): string {
        if (pxt.appTarget) return pxt.appTarget.id;

        const cfg = (<any>window).pxtConfig;
        if (cfg) return cfg.targetId;

        const bndl = (<any>window).pxtTargetBundle;
        if (bndl) return bndl.id;

        return '';
    }

    let impl: IStorage;
    function init() {
        if (impl) return;
        // test if local storage is supported
        const sid = storageId();
        let supported = false;
        // no local storage in sandbox mode
        if (!pxt.shell.isSandboxMode()) {
            try {
                const rand = pxt.Util.guidGen();
                window.localStorage[sid] = rand;
                const v = window.localStorage[sid];
                supported = v === rand;
            } catch (e) { }
        }

        if (!supported) {
            impl = new MemoryStorage();
            pxt.debug('storage: in memory');
        } else {
            impl = new LocalStorage(sid);
            pxt.debug(`storage: local under ${sid}`)
        }
    }

    export function setLocal(key: string, value: string) {
        init()
        impl.setItem(key, value);
    }

    export function getLocal(key: string): string {
        init()
        return impl.getItem(key);
    }

    export function removeLocal(key: string) {
        init()
        impl.removeItem(key);
    }

    export function clearLocal() {
        init()
        impl.clear();
    }
}

/**
 * Storage that will be shared across localhost frames when developing locally. Uses regular browser storage in production.
 * One side effect: Localhost storage will be shared between different browsers and incognito tabs as well. To disable this
 * behavior, set the `routingEnabled` switch below to `false`.
 */
namespace pxt.storage.shared {
    /**
     * Override switch. Setting this to `false` will stop routing calls to the pxt server, using browser storage instead.
     */
    const routingEnabled = true;

    // Specify host and port explicitly so that localhost frames not served on the default port (e.g. skillmap) can access it.
    const localhostStoreUrl = "http://localhost:3232/api/store/";

    function useSharedLocalStorage(): boolean {
        return routingEnabled && pxt.BrowserUtils.isLocalHostDev() && !pxt.BrowserUtils.noSharedLocalStorage();
    }

    function sharedStorageNamespace(): string {
        if (pxt.BrowserUtils.isChromiumEdge()) { return "chromium-edge"; }
        return pxt.BrowserUtils.browser();
    }

    export async function getAsync<T>(container: string, key: string): Promise<T> {
        if (useSharedLocalStorage()) {
            container += '-' + sharedStorageNamespace();
            const resp = await pxt.Util.requestAsync({
                url: `${localhostStoreUrl}${encodeURIComponent(container)}/${encodeURIComponent(key)}`,
                method: "GET",
                allowHttpErrors: true
            });

            if (resp.statusCode === 204) {
                throw new Error(`Missing ${key} not available in ${container}`);
            } else if (resp.json) {
                return resp.json as T;
            } else if (resp.text) {
                return resp.text as any as T;
            } else {
                return undefined;
            }
        } else {
            const sval = pxt.storage.getLocal(`${container}:${key}`);
            const val = pxt.Util.jsonTryParse(sval);
            return val ? val : sval;
        }
    }

    export async function setAsync(container: string, key: string, val: any): Promise<void> {
        if (typeof val == "undefined") {
            await pxt.storage.shared.delAsync(container, key);
            return;
        }
        let sval = "";
        if (typeof val === "object")
            sval = JSON.stringify(val);
        else
            sval = val.toString();
        if (useSharedLocalStorage()) {
            container += '-' + sharedStorageNamespace();
            const data = {
                type: (typeof val === "object") ? "json" : "text",
                val: sval
            };
            const sdata = JSON.stringify(data);
            await pxt.Util.requestAsync({
                url: `${localhostStoreUrl}${encodeURIComponent(container)}/${encodeURIComponent(key)}`,
                method: "POST",
                data: sdata
            });
        } else {
            pxt.storage.setLocal(`${container}:${key}`, sval);
        }
    }

    export async function delAsync(container: string, key: string): Promise<void> {
        if (useSharedLocalStorage()) {
            container += '-' + sharedStorageNamespace();
            await pxt.Util.requestAsync({
                url: `${localhostStoreUrl}${encodeURIComponent(container)}/${encodeURIComponent(key)}`,
                method: "DELETE",
                allowHttpErrors: true
            });
        } else {
            pxt.storage.removeLocal(`${container}:${key}`);
        }
    }
}
