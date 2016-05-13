namespace pxt.storage {
    export function storageId(): string {
        let id = pxt.appTarget ? pxt.appTarget.id : (<any>window).pxtConfig ? (<any>window).pxtConfig.targetId : '';
        return id;
    }
    function targetKey(key: string): string {
        return storageId() + '/' + key;
    }
    export function setLocal(key: string, value: string) {
        window.localStorage[targetKey(key)] = value;
    }

    export function getLocal(key: string): string {
        return window.localStorage[targetKey(key)];
    }

    export function removeLocal(key: string) {
        window.localStorage.removeItem(targetKey(key));
    }

    export function clearLocal() {
        let prefix = targetKey('');
        let keys: string[] = [];
        for (let i = 0; i < window.localStorage.length; ++i) {
            let key = window.localStorage.key(i);
            if (key.indexOf(prefix) == 0)
                keys.push(key);
        }
        keys.forEach(key => window.localStorage.removeItem(key));
    }
}