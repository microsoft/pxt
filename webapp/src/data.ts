import * as React from "react";
import * as core from "./core";

import Cloud = pxt.Cloud;
import Util = pxt.Util;

pxt.data.mountVirtualApi("cloud", {
    getAsync: p => Cloud.privateGetAsync(pxt.data.stripProtocol(p)).catch(core.handleNetworkError),
    expirationTime: p => 60 * 1000,
    isOffline: () => !Cloud.isOnline(),
})

pxt.data.mountVirtualApi("cloud-search", {
    getAsync: p => Cloud.privateGetAsync(pxt.data.stripProtocol(p)).catch(e => {
        core.handleNetworkError(e, [404])
        return { statusCode: 404, headers: {}, json: {} }
    }),
    expirationTime: p => 60 * 1000,
    isOffline: () => !Cloud.isOnline(),
})

pxt.data.mountVirtualApi("gallery", {
    getAsync: p => pxt.gallery.loadGalleryAsync(pxt.data.stripProtocol(decodeURIComponent(p))).catch((e) => {
        return Promise.resolve(e);
    }),
    expirationTime: p => 3600 * 1000
})

pxt.data.mountVirtualApi("gh-search", {
    getAsync: query => pxt.targetConfigAsync()
        .then(config => pxt.github.searchAsync(pxt.data.stripProtocol(query), config ? config.packages : undefined))
        .catch(core.handleNetworkError),
    expirationTime: p => 60 * 1000,
    isOffline: () => !Cloud.isOnline(),
})

pxt.data.mountVirtualApi("gh-pkgcfg", {
    getAsync: query =>
        pxt.github.pkgConfigAsync(pxt.data.stripProtocol(query)).catch(core.handleNetworkError),
    expirationTime: p => 60 * 1000,
    isOffline: () => !Cloud.isOnline(),
})

// gh-commits:repo#sha
pxt.data.mountVirtualApi("gh-commits", {
    getAsync: query => {
        const p = pxt.data.stripProtocol(query);
        const [ repo, sha ] = p.split('#', 2)
        return pxt.github.getCommitsAsync(repo, sha).catch(e => {
            core.handleNetworkError(e);
            return [];
        })
    },
    expirationTime: p => 60 * 1000,
    isOffline: () => !Cloud.isOnline(),
})

let targetConfigPromise: Promise<pxt.TargetConfig> = undefined;
pxt.data.mountVirtualApi("target-config", {
    getAsync: query => {
        if (!targetConfigPromise)
            targetConfigPromise = pxt.targetConfigAsync()
                .then(js => {
                    if (js) {
                        pxt.storage.setLocal("targetconfig", JSON.stringify(js))
                        pxt.data.invalidate("target-config");
                        pxt.data.invalidate("gh-search");
                        pxt.data.invalidate("gh-pkgcfg");
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

export function invalidateHeader(prefix: string, hd: pxt.workspace.Header) {
    if (hd)
        pxt.data.invalidate(prefix + ':' + hd.id);
}

export class Component<TProps, TState> extends React.Component<TProps, TState> implements pxt.data.DataSubscriber {
    subscriptions: pxt.data.CacheEntry[] = [];
    renderCoreOk = false;

    constructor(props: TProps) {
        super(props);
        this.state = <any>{}
    }

    getData<T = any>(path: string) {
        const fetchResult = this.getDataWithStatus<T>(path);
        return fetchResult.data as T;
    }

    /**
     * Like getData, but the data is wrapped in a result object that indicates the status of the fetch operation
     */
    getDataWithStatus<T = any>(path: string): pxt.data.DataFetchResult<T> {
        if (!this.renderCoreOk)
            Util.oops("Override renderCore() not render()")
        return pxt.data.getCached(this, path)
    }

    onDataChanged(): void {
        this.forceUpdate();
    }

    componentWillUnmount(): void {
        pxt.data.unsubscribe(this)
    }

    child(selector: string) {
        return core.findChild(this, selector)
    }

    renderCore(): JSX.Element {
        return null;
    }

    render() {
        pxt.data.unsubscribe(this)
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
