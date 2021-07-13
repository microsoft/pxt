namespace pxt.data {
    export type Action = () => void;
    export type DataSubscriber = {
        subscriptions: CacheEntry[];
        onDataChanged: (path: string) => void;
    };

    import Cloud = pxt.Cloud;
    import Util = pxt.Util;

    export interface CacheEntry {
        path: string;
        data: any;
        lastRefresh: number;
        queued: boolean;
        callbackOnce: Action[];
        components: DataSubscriber[];
        api: VirtualApi;
    }

    export enum FetchStatus {
        Pending,
        Complete,
        Error,
        Offline
    };

    export interface DataFetchResult<T> {
        data?: T;
        status: FetchStatus;
    }

    const virtualApis: pxt.Map<VirtualApi> = {};
    let cachedData: pxt.Map<CacheEntry> = {};
    let cacheName: string;


    export function subscribe(component: DataSubscriber, path: string) {
        let e = lookup(path)
        let lst = e.components
        if (lst.indexOf(component) < 0) {
            lst.push(component)
            component.subscriptions.push(e)
        }
    }

    export function unsubscribe(component: DataSubscriber) {
        let lst = component.subscriptions
        if (lst.length == 0) return
        component.subscriptions = []
        lst.forEach(ce => {
            let idx = ce.components.indexOf(component)
            if (idx >= 0) ce.components.splice(idx, 1)
        })
    }

    function expired(ce: CacheEntry) {
        if (!ce.api.expirationTime)
            return !ce.lastRefresh; // needs to be refreshed at least once
        return ce.data == null || (Date.now() - ce.lastRefresh) > ce.api.expirationTime(ce.path)
    }

    function shouldCache(ce: CacheEntry) {
        if (!ce.data || ce.data instanceof Error) return false;
        return /^cloud:(me\/settings|ptr-pkg-)/.test(ce.path);
    }

    export function clearCache() {
        cachedData = {};
        saveCache();
    }

    export function loadCache(cacheName_: string) {
        cacheName = cacheName_;
        if (cacheName) {
            JSON.parse(pxt.storage.getLocal(cacheName) || "[]").forEach((e: any) => {
                let ce = lookup(e.path)
                ce.data = e.data
            });
        }
    }

    function saveCache() {
        if (cacheName) {
            let obj = Util.values(cachedData).filter(e => shouldCache(e)).map(e => {
                return {
                    path: e.path,
                    data: e.data
                }
            });
            pxt.storage.setLocal(cacheName, JSON.stringify(obj));
        }
    }

    function matches(ce: CacheEntry, prefix: string) {
        return ce.path.slice(0, prefix.length) == prefix;
    }

    function notify(ce: CacheEntry, path: string) {
        if (shouldCache(ce)) saveCache();

        let lst = ce.callbackOnce
        if (lst.length > 0) {
            ce.callbackOnce = []
            Util.nextTick(() => lst.forEach(f => f()))
        }

        if (ce.components.length > 0)
            ce.components.forEach(c => Util.nextTick(() => c.onDataChanged(path)))
    }

    function getVirtualApi(path: string) {
        let m = /^([\w\-]+):/.exec(path)
        if (!m || !virtualApis[m[1]])
            Util.oops("bad data protocol: " + path)
        return virtualApis[m[1]]
    }

    function queueNotify(ce: CacheEntry, path: string) {
        if (ce.queued) return

        if (ce.api.isOffline && ce.api.isOffline())
            return

        ce.queued = true

        let final = (res: any) => {
            ce.data = res
            ce.lastRefresh = pxt.Util.now()
            ce.queued = false
            notify(ce, path)
        }

        if (ce.api.isSync)
            final(ce.api.getSync(ce.path))
        else {
            const p = ce.api.getAsync(ce.path);
            p.then(final)
        }
    }

    function lookup(path: string) {
        if (!cachedData.hasOwnProperty(path))
            cachedData[path] = {
                path: path,
                data: null,
                lastRefresh: 0,
                queued: false,
                callbackOnce: [],
                components: [],
                api: getVirtualApi(path)
            }
        return cachedData[path]
    }

    export function getCached(component: DataSubscriber, path: string): DataFetchResult<any> {
        subscribe(component, path)
        return getDataWithStatus(path);
    }

    //
    // Public interface
    //

    export interface VirtualApi {
        getAsync?(path: string): Promise<any>;
        getSync?(path: string): any;
        isSync?: boolean;
        expirationTime?(path: string): number; // in milliseconds
        isOffline?: () => boolean;
        onInvalidated?: (path: string) => void;
    }

    export function mountVirtualApi(protocol: string, handler: VirtualApi) {
        Util.assert(!virtualApis[protocol])
        Util.assert(!!handler.getSync || !!handler.getAsync)
        Util.assert(!!handler.getSync != !!handler.getAsync)
        handler.isSync = !!handler.getSync
        virtualApis[protocol] = handler
    }

    export function stripProtocol(path: string) {
        let m = /^([\w\-]+):(.*)/.exec(path)
        if (m) return m[2]
        else Util.oops("protocol missing in: " + path)
        return path
    }

    export function invalidate(path: string) {
        const prefix = path.replace(/:\*$/, ':'); // remove trailing "*";
        Util.values(cachedData).forEach(ce => {
            if (matches(ce, prefix)) {
                ce.lastRefresh = 0;
                if (ce.components.length > 0)
                    queueNotify(lookup(ce.path), path)
                if (ce.api.onInvalidated) {
                    ce.api.onInvalidated(path);
                }
            }
        })
    }

    export function invalidateHeader(prefix: string, hd: pxt.workspace.Header) {
        if (hd)
            invalidate(prefix + ':' + hd.id);
    }

    export function getAsync<T = any>(path: string) {
        let ce = lookup(path)

        if (ce.api.isSync)
            return Promise.resolve(ce.api.getSync(ce.path))

        if (!Cloud.isOnline() || !expired(ce))
            return Promise.resolve(ce.data)

        return new Promise<T>((resolve, reject) => {
            ce.callbackOnce.push(() => {
                resolve(ce.data)
            })
            queueNotify(ce, path)
        })
    }

    export function getData<T>(path: string): T {
        return getDataWithStatus<T>(path).data;
    }

    export function getDataWithStatus<T>(path: string): DataFetchResult<T> {
        let r = lookup(path)
        if (r.api.isSync)
            return {
                data: r.api.getSync(r.path),
                status: FetchStatus.Complete
            }

        // cache async values
        let fetchRes: DataFetchResult<T> = {
            data: r.data,
            status: FetchStatus.Complete
        };

        if (expired(r) || r.data instanceof Error) {
            fetchRes.status = r.data instanceof Error ? FetchStatus.Error : FetchStatus.Pending;
            if (r.api.isOffline && r.api.isOffline()) {
                // The request will not be requeued so we don't want to show it as pending
                fetchRes.status = FetchStatus.Offline;
            } else {
                queueNotify(r, path)
            }
        }

        return fetchRes;
    }
}