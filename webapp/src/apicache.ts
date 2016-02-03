import * as React from "react";
import * as workspace from "./workspace";

export type Action = () => void;
export type Component = React.Component<any,any>;

interface CacheEntry {
    path: string;
    data: any;
    lastRefresh: number;
    queued: boolean;
    callbackOnce: Action[];
    components: Component[];
}

var cachedData: Util.StringMap<CacheEntry> = {};

function subscribe(component: Component, path: string) {
    let lst = lookup(path).components
    if (lst.indexOf(component) < 0)
    lst.push(component)
}

// TODO do we need to speed this up?
function unsubscribe(component: Component) {
    Util.values(cachedData).forEach(ce => {
        let idx = ce.components.indexOf(component)
        if (idx >= 0) ce.components.splice(idx, 1)
    })
}

function expired(ce: CacheEntry) {
    return ce.data == null || (Date.now() - ce.lastRefresh) > 60000;
}

function shouldCache(ce: CacheEntry) {
    if (!ce.data) return false
    return /^me\/settings/.test(ce.path)
}

function loadCache() {
    JSON.parse(window.localStorage["apiCache"] || "[]").forEach((e:any) => {
        let ce = lookup(e.path)
        ce.data = e.data
    })
}

function saveCache() {
    let obj = Util.values(cachedData).filter(e => shouldCache(e)).map(e => { return { 
        path: e.path,
        data: e.data
    } })    
    window.localStorage["apiCache"] = JSON.stringify(obj)
}

function matches(ce:CacheEntry, prefix:string)
{
    return ce.path.slice(0, prefix.length) == prefix;
}

function notify(ce: CacheEntry) {
    if (shouldCache(ce)) saveCache();
    while (ce.callbackOnce.length > 0) {
        let f = ce.callbackOnce.shift()
        f()
    }
    ce.components.forEach(c => c.forceUpdate())
}

function queue(ce: CacheEntry) {
    if (ce.queued) return
    ce.queued = true
    Cloud.privateGetAsync(ce.path)
        .then(res => {
            ce.data = res
            ce.lastRefresh = Date.now()
            ce.queued = false
            notify(ce)
        })
}

function lookup(path: string) {
    if (!cachedData.hasOwnProperty(path))
        cachedData[path] = {
            path: path,
            data: null,
            lastRefresh: 0,
            queued: false,
            callbackOnce: [],
            components: []
        }
    return cachedData[path]
}

export function invalidate(prefix:string)
{
    Util.values(cachedData).forEach(ce => {
        if (matches(ce, prefix)) ce.lastRefresh = 0;
    })
}

function getCached(component:Component, path: string) {
    subscribe(component, path)
    let res = lookup(path)
    if (expired(res))
        queue(res)
    return res.data
}

export function getAsync(path: string) {
    let res = lookup(path)
    if (!expired(res))
        return Promise.resolve(res.data)
    return new Promise((resolve, reject) => {
        res.callbackOnce.push(() => {
            resolve(res.data)
        })
    })
}

export class RestComponent<T,S> extends React.Component<T,S> {
    constructor(props: T) {
        super(props);
    }
    
    getApi(path:string)
    {
        return getCached(this, path)
    }
    
    componentWillUnmount(): void{
        unsubscribe(this)
    }
}

loadCache();