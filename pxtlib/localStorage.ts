namespace pxt.storage {
    interface IStorage {
        removeItem(key: string): void;
        getItem(key: string): string;
        setItem(key: string, value: string): void;
        clear(): void;
    }

    class MemoryStorage implements IStorage {
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
                window.localStorage[sid] = '1';
                let v = window.localStorage[sid];
                supported = true;
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