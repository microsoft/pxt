import * as React from "react";
import * as core from "./core";

export type Action = () => void;
export type AnyComponent = Component<any, any>;

import Cloud = pxt.Cloud;
import Util = pxt.Util;

interface CacheEntry {
    path: string;
    data: any;
    lastRefresh: number;
    queued: boolean;
    callbackOnce: Action[];
    components: AnyComponent[];
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

const virtualApis: pxt.Map<VirtualApi> = {}

mountVirtualApi("cloud", {
    getAsync: p => Cloud.privateGetAsync(stripProtocol(p)).catch(core.handleNetworkError),
    expirationTime: p => 60 * 1000,
    isOffline: () => !Cloud.isOnline(),
})

mountVirtualApi("cloud-search", {
    getAsync: p => Cloud.privateGetAsync(stripProtocol(p)).catch(e => {
        core.handleNetworkError(e, [404])
        return { statusCode: 404, headers: {}, json: {} }
    }),
    expirationTime: p => 60 * 1000,
    isOffline: () => !Cloud.isOnline(),
})

mountVirtualApi("gallery", {
    getAsync: p => pxt.gallery.loadGalleryAsync(stripProtocol(decodeURIComponent(p))).catch((e) => {
        return Promise.resolve(e);
    }),
    expirationTime: p => 3600 * 1000
})

mountVirtualApi("td-cloud", {
    getAsync: p =>
        Util.httpGetJsonAsync("https://www.touchdevelop.com/api/" + stripProtocol(p))
            .catch(core.handleNetworkError),
    expirationTime: p => 60 * 1000,
})

mountVirtualApi("gh-search", {
    getAsync: query => pxt.targetConfigAsync()
        .then(config => pxt.github.searchAsync(stripProtocol(query), config ? config.packages : undefined))
        .catch(core.handleNetworkError),
    expirationTime: p => 60 * 1000,
    isOffline: () => !Cloud.isOnline(),
})

mountVirtualApi("gh-pkgcfg", {
    getAsync: query =>
        pxt.github.pkgConfigAsync(stripProtocol(query)).catch(core.handleNetworkError),
    expirationTime: p => 60 * 1000,
    isOffline: () => !Cloud.isOnline(),
})

let targetConfigPromise: Promise<pxt.TargetConfig> = undefined;
mountVirtualApi("target-config", {
    getAsync: query => {
        if (!targetConfigPromise)
            targetConfigPromise = pxt.targetConfigAsync()
                .then(js => {
                    if (js) {
                        pxt.storage.setLocal("targetconfig", JSON.stringify(js))
                        invalidate("target-config");
                        invalidate("gh-search");
                        invalidate("gh-pkgcfg");
                    }
                    return js;
                })
                .catch(core.handleNetworkError);
        // return cached value or try again
        const cfg = JSON.parse(pxt.storage.getLocal("targetconfig") || "null") as pxt.TargetConfig;
        if (cfg) return Promise.resolve(cfg);
        return targetConfigPromise;
    },
    expirationTime: p => 24 * 3600 * 1000,
    isOffline: () => !Cloud.isOnline()
})

let cachedData: pxt.Map<CacheEntry> = {};

function subscribe(component: AnyComponent, path: string) {
    let e = lookup(path)
    let lst = e.components
    if (lst.indexOf(component) < 0) {
        lst.push(component)
        component.subscriptions.push(e)
    }
}

function unsubscribe(component: AnyComponent) {
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
        return ce.data != null;
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

function loadCache() {
    JSON.parse(pxt.storage.getLocal("apiCache2") || "[]").forEach((e: any) => {
        let ce = lookup(e.path)
        ce.data = e.data
    })
}

function saveCache() {
    let obj = Util.values(cachedData).filter(e => shouldCache(e)).map(e => {
        return {
            path: e.path,
            data: e.data
        }
    })
    pxt.storage.setLocal("apiCache2", JSON.stringify(obj))
}

function matches(ce: CacheEntry, prefix: string) {
    return ce.path.slice(0, prefix.length) == prefix;
}

function notify(ce: CacheEntry) {
    if (shouldCache(ce)) saveCache();

    let lst = ce.callbackOnce
    if (lst.length > 0) {
        ce.callbackOnce = []
        Util.nextTick(() => lst.forEach(f => f()))
    }

    if (ce.components.length > 0)
        ce.components.forEach(c => Util.nextTick(() => c.forceUpdate()))
}

function getVirtualApi(path: string) {
    let m = /^([\w\-]+):/.exec(path)
    if (!m || !virtualApis[m[1]])
        Util.oops("bad data protocol: " + path)
    return virtualApis[m[1]]
}

function queue(ce: CacheEntry) {
    if (ce.queued) return

    if (ce.api.isOffline && ce.api.isOffline())
        return

    ce.queued = true

    let final = (res: any) => {
        ce.data = res
        ce.lastRefresh = Date.now()
        ce.queued = false
        notify(ce)
    }

    if (ce.api.isSync)
        final(ce.api.getSync(ce.path))
    else
        ce.api.getAsync(ce.path).done(final)
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

function getCached(component: AnyComponent, path: string): DataFetchResult<any> {
    subscribe(component, path)
    let r = lookup(path)
    if (r.api.isSync)
        return {
            data: r.api.getSync(r.path),
            status: FetchStatus.Complete
        }

    let fetchRes: DataFetchResult<any> = {
        data: r.data,
        status: FetchStatus.Complete
    };

    if (expired(r) || r.data instanceof Error) {
        fetchRes.status = r.data instanceof Error ? FetchStatus.Error : FetchStatus.Pending;
        if (r.api.isOffline && r.api.isOffline()) {
            // The request will not be requeued so we don't want to show it as pending
            fetchRes.status = FetchStatus.Offline;
        } else {
            queue(r)
        }
    }

    return fetchRes;
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
    onInvalidated?: () => void;
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

export function invalidate(prefix: string) {
    Util.values(cachedData).forEach(ce => {
        if (matches(ce, prefix)) {
            ce.lastRefresh = 0;
            if (ce.components.length > 0)
                queue(lookup(ce.path))
            if (ce.api.onInvalidated)
                ce.api.onInvalidated();
        }
    })
}

export function getAsync(path: string) {
    let ce = lookup(path)

    if (ce.api.isSync)
        return Promise.resolve(ce.api.getSync(ce.path))

    if (!Cloud.isOnline() || !expired(ce))
        return Promise.resolve(ce.data)

    return new Promise((resolve, reject) => {
        ce.callbackOnce.push(() => {
            resolve(ce.data)
        })
        queue(ce)
    })
}

export class Component<TProps, TState> extends React.Component<TProps, TState> {
    subscriptions: CacheEntry[] = [];
    renderCoreOk = false;

    constructor(props: TProps) {
        super(props);
        this.state = <any>{}
    }

    getData(path: string) {
        const fetchResult = this.getDataWithStatus(path);
        return fetchResult.data;
    }

    /**
     * Like getData, but the data is wrapped in a result object that indicates the status of the fetch operation
     */
    getDataWithStatus(path: string): DataFetchResult<any> {
        if (!this.renderCoreOk)
            Util.oops("Override renderCore() not render()")
        return getCached(this, path)
    }

    componentWillUnmount(): void {
        unsubscribe(this)
    }

    child(selector: string) {
        return core.findChild(this, selector)
    }

    renderCore(): JSX.Element {
        return null;
    }

    render() {
        unsubscribe(this)
        this.renderCoreOk = true;
        return this.renderCore();
    }

    setStateAsync<K extends keyof TState>(state: Pick<TState, K>): Promise<void> {
        return new Promise((resolve, reject) => {
            this.setState(state, () => {
                resolve();
            })
        })
    }
}

export class PureComponent<TProps, TState> extends React.PureComponent<TProps, TState> {
    renderCoreOk = false;

    constructor(props: TProps) {
        super(props);
        this.state = <any>{}
    }

    child(selector: string) {
        return core.findChild(this, selector)
    }

    renderCore(): JSX.Element {
        return null;
    }

    render() {
        this.renderCoreOk = true;
        return this.renderCore();
    }
}

loadCache();
