interface SimWorkerOptions {
    urls?: string[];
}

interface SimWorkerContext {
    setSimulatorWorkerOptions: (opts: SimWorkerOptions) => void;
}

initSimulatorServiceWorker();

function initSimulatorServiceWorker() {
    // Empty string for released, otherwise contains the ref or version path
    const ref = `@relprefix@`.replace("---", "").replace(/^\//, "");

    // We don't do offline for version paths, only named releases
    const isNamedEndpoint = ref.indexOf("/") === -1;

    // pxtRelId is replaced with the commit hash for this release
    const refCacheName = "makecode-sim;" + ref + ";@pxtRelId@";

    const simUrls = [
        // This is the URL loaded in the simulator iframe (includes ref)
        `@simUrl@`,

        `/cdn/bluebird.min.js`,
        `/cdn/pxtsim.js`,
        `/sim/sim.js`,
    ];

    const allFiles = simUrls.map(url => url.trim())
        .filter(url => !!url && url.indexOf("@") !== 0);

    // This function is called by workerConfig.js in the target to configure any
    // extra URLs that need to be cached
    (self as unknown as SimWorkerContext).setSimulatorWorkerOptions = opts => {
        if (opts && Array.isArray(opts.urls)) {
            allFiles.push(...resolveURLs(opts.urls));
        }
    }

    let didInstall = false;

    self.addEventListener("install", (ev: ServiceWorkerEvent) => {
        if (!isNamedEndpoint) {
            console.log("Skipping service worker install for unnamed endpoint");
            return;
        }

        didInstall = true;

        // Check to see if there are any extra sim URLs to be cached by the target
        try {
            importScripts(`@simworkerconfigUrl@`);
        }
        catch (e) {
            // This file is optional in the target, so ignore 404 response
            console.log("Failed to load target service worker config")
        }

        console.log("Installing service worker...")
        ev.waitUntil(caches.open(refCacheName)
            .then(cache => {
                console.log("Opened cache")
                return cache.addAll(dedupe(allFiles))
            })
            .then(() => (self as any).skipWaiting()))
    });

    self.addEventListener("activate", (ev: ServiceWorkerEvent) => {
        if (!isNamedEndpoint) {
            console.log("Skipping service worker activate for unnamed endpoint");
            return;
        }

        console.log("Activating service worker...")
        ev.waitUntil(caches.keys()
            .then(cacheNames => {
                // Delete all caches that "belong" to this ref except for the current version
                const toDelete = cacheNames.filter(c => {
                    const cacheRef = getRefFromCacheName(c);
                    return cacheRef === null || (cacheRef === ref && c !== refCacheName);
                })

                return Promise.all(
                    toDelete.map(name => caches.delete(name))
                );
            })
            .then(() => {
                if (didInstall) {
                    // Only notify clients for the first activation
                    didInstall = false;
                    return notifyAllClientsAsync();
                }
                return Promise.resolve();
            }))
    });

    self.addEventListener("fetch", (ev: ServiceWorkerEvent) => {
        ev.respondWith(caches.match(ev.request)
            .then(response => {
                return response || fetch(ev.request)
            }))
    });

    function dedupe(urls: string[]) {
        const res: string[] = [];

        for (const url of urls) {
            if (res.indexOf(url) === -1) res.push(url)
        }

        return res;
    }

    function resolveURLs(urls: string[]) {
        return dedupe(urls.map(url => url.trim()).filter(url => !!url));
    }

    function getRefFromCacheName(name: string) {
        const parts = name.split(";");

        if (parts.length !== 3) return null;

        return parts[1];
    }

    function notifyAllClientsAsync() {
        const scope = (self as unknown as ServiceWorkerScope);

        return scope.clients.claim().then(() => scope.clients.matchAll()).then(clients => {
            clients.forEach(client => client.postMessage({
                type: "serviceworker",
                state: "activated",
                ref: ref
            }))
        });
    }
}
