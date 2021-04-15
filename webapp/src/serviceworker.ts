interface ServiceWorkerEvent extends Event {
    waitUntil<U>(promise: Promise<U>): void;
    respondWith(response: Promise<Response>): void;
    request: Request;
}

interface ServiceWorkerScope {
    clients: ServiceWorkerClients;
}

interface ServiceWorkerClients {
    matchAll(): Promise<ServiceWorkerClient[]>;
    claim(): Promise<void>;
}

interface ServiceWorkerClient {
    readonly id: string;
    readonly type: "window" | "worker" | "sharedworker";
    readonly url: string;

    postMessage(message: pxt.ServiceWorkerEvent | pxt.ServiceWorkerMessage): void;
}

enum DisconnectResponse {
    Disconnected,
    Waiting,
    TimedOut
}

initWebappServiceWorker();

function initWebappServiceWorker() {
    // Empty string for released, otherwise contains the ref or version path
    const ref = `@relprefix@`.replace("---", "").replace(/^\//, "");

    // We don't do offline for version paths, only named releases
    const isNamedEndpoint = ref.indexOf("/") === -1;

    // pxtRelId is replaced with the commit hash for this release
    const refCacheName = "makecode;" + ref + ";@pxtRelId@";

    const cdnUrl = `@cdnUrl@`;

    const webappUrls = [
        // The current page
        `@targetUrl@/` + ref,
        `@simUrl@`,

        // webapp files
        `/blb/semantic.js`,
        `/blb/main.js`,
        `/blb/pxtapp.js`,
        `/blb/typescript.js`,
        `/blb/marked/marked.min.js`,
        `/blb/highlight.js/highlight.pack.js`,
        `/blb/jquery.js`,
        `/blb/pxtlib.js`,
        `/blb/pxtcompiler.js`,
        `/blb/pxtpy.js`,
        `/blb/pxtblockly.js`,
        `/blb/pxtwinrt.js`,
        `/blb/pxteditor.js`,
        `/blb/pxtsim.js`,
        `/blb/pxtembed.js`,
        `/blb/pxtworker.js`,
        `/blb/pxtweb.js`,
        `/blb/blockly.css`,
        `/blb/semantic.css`,
        `/blb/rtlsemantic.css`,

        // blockly
        `/cdn/blockly/media/sprites.png`,
        `/cdn/blockly/media/click.mp3`,
        `/cdn/blockly/media/disconnect.wav`,
        `/cdn/blockly/media/delete.mp3`,

        // monaco; keep in sync with webapp/public/index.html
        `/blb/vs/loader.js`,
        `/blb/vs/base/worker/workerMain.js`,
        `/blb/vs/basic-languages/bat/bat.js`,
        `/blb/vs/basic-languages/cpp/cpp.js`,
        `/blb/vs/basic-languages/python/python.js`,
        `/blb/vs/basic-languages/markdown/markdown.js`,
        `/blb/vs/editor/editor.main.css`,
        `/blb/vs/editor/editor.main.js`,
        `/blb/vs/editor/editor.main.nls.js`,
        `/blb/vs/language/json/jsonMode.js`,
        `/blb/vs/language/json/jsonWorker.js`,

        // charts
        `/blb/smoothie/smoothie_compressed.js`,
        `/blb/images/Bars_black.gif`,

        // gifjs
        `/blb/gifjs/gif.js`,

        // ai
        `/blb/ai.0.js`,

        // target
        `/blb/target.js`,

        // These macros should be replaced by the backend
        `@targetFieldEditorsJs@`,
        `@targetEditorJs@`,
        `@defaultLocaleStrings@`,
        `@targetUrl@@monacoworkerjs@`,
        `@targetUrl@@workerjs@`
    ];

    // Replaced by the backend by a list of encoded urls separated by semicolons
    const cachedHexFiles = decodeURLs(`@cachedHexFilesEncoded@`);
    const cachedTargetImages = decodeURLs(`@targetImagesEncoded@`);

    // Duplicate entries in this list will cause an exception so call dedupe
    // just in case
    const allFiles = dedupe(webappUrls.concat(cachedTargetImages)
        .map(url => url.trim())
        .filter(url => !!url && url.indexOf("@") !== 0));

    let didInstall = false;

    self.addEventListener("install", (ev: ServiceWorkerEvent) => {
        if (!isNamedEndpoint) {
            console.log("Skipping service worker install for unnamed endpoint");
            return;
        }

        didInstall = true;
        console.log("Installing service worker...")
        ev.waitUntil(caches.open(refCacheName)
            .then(cache => {
                console.log("Opened cache");
                console.log("Caching:\n" + allFiles.join("\n"));
                return cache.addAll(allFiles).then(() => cache);
            })
            .then(cache =>
                cache.addAll(cachedHexFiles).catch(e => {
                    // Hex files might return a 404 if they haven't hit the backend yet. We
                    // need to catch the exception or the service worker will fail to install
                    console.log("Failed to cache hexfiles")
                })
            )
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


    let lockGranted: string;
    let grantingLock: boolean;
    let pendingDisconnectResolver: (resp: DisconnectResponse) => void;
    self.addEventListener("message", async (ev: MessageEvent) => {
        const message: pxt.ServiceWorkerClientMessage = ev.data;
        if (message?.type === "serviceworkerclient") {
            if (message.action === "request-packet-io-lock") {
                if (grantingLock) {
                    await sendToAllClientsAsync({
                        type: "serviceworker",
                        action: "packet-io-lock-granted",
                        granted: false,
                        lock: message.lock
                    });
                    return;
                }
                if (lockGranted === message.lock) {
                    await sendToAllClientsAsync({
                        type: "serviceworker",
                        action: "packet-io-lock-granted",
                        granted: true,
                        lock: message.lock
                    });
                    return;
                }
                grantingLock = true;
                console.log("Received lock request " + message.lock);
                if (lockGranted) {
                    let resp: DisconnectResponse;
                    do {
                        console.log("Sending disconnect request " + message.lock);
                        resp = await waitForLockDisconnectAsync();
                        if (resp === DisconnectResponse.Waiting) {
                            console.log("Waiting on disconnect request " + message.lock);
                            await delay(1000);
                        }
                    } while (resp === DisconnectResponse.Waiting)
                }

                console.log("Granted lock request " + message.lock);
                lockGranted = message.lock;
                await sendToAllClientsAsync({
                    type: "serviceworker",
                    action: "packet-io-lock-granted",
                    granted: true,
                    lock: message.lock
                });
                grantingLock = false;
            }
            else if (message.action === "release-packet-io-lock") {
                console.log("Received disconnect for " + lockGranted);
                lockGranted = undefined;
                if (pendingDisconnectResolver) pendingDisconnectResolver(DisconnectResponse.Disconnected);
            }
            else if (message.action === "packet-io-lock-disconnect") {
                console.log("Received disconnect response for " + lockGranted);

                if (message.didDisconnect) lockGranted = undefined;
                if (pendingDisconnectResolver) pendingDisconnectResolver(message.didDisconnect ? DisconnectResponse.Disconnected : DisconnectResponse.Waiting);
            }
        }
    });

    async function sendToAllClientsAsync(message: pxt.ServiceWorkerMessage) {
        const clients = await (self as unknown as ServiceWorkerScope).clients.matchAll()
        clients.forEach(c => c.postMessage(message))
    }

    function waitForLockDisconnectAsync() {
        let ref: any;

        const promise = new Promise<DisconnectResponse>((resolve) => {
            console.log("Waiting for disconnect " + lockGranted);
            pendingDisconnectResolver = resolve;
            sendToAllClientsAsync({
                type: "serviceworker",
                action: "packet-io-lock-disconnect",
                lock: lockGranted
            });
        })

        const timeoutPromise = new Promise<DisconnectResponse>(resolve => {
            ref = setTimeout(() => {
                console.log("Timed-out disconnect request " + lockGranted);
                resolve(DisconnectResponse.TimedOut);
            }, 10000)
        });

        return Promise.race([ promise, timeoutPromise ])
            .then(resp => {
                clearTimeout(ref);
                pendingDisconnectResolver = undefined
                return resp;
            })
    }

    function dedupe(urls: string[]) {
        const res: string[] = [];

        for (const url of urls) {
            if (res.indexOf(url) === -1) res.push(url)
        }

        return res;
    }

    function getRefFromCacheName(name: string) {
        const parts = name.split(";");

        if (parts.length !== 3) return null;

        return parts[1];
    }

    function decodeURLs(encodedURLs: string) {
        // Charcode 64 is '@', we need to calculate it because otherwise the minifier
        // will combine the string concatenation into @cdnUrl@ and get mangled by the backend
        const cdnEscaped = String.fromCharCode(64) + "cdnUrl" + String.fromCharCode(64);

        return dedupe(
            encodedURLs.split(";")
                .map(encoded => decodeURIComponent(encoded).replace(cdnEscaped, cdnUrl).trim()
            )
        );
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

    function delay(millis: number): Promise<void> {
        return new Promise(resolve => {
            setTimeout(resolve, millis);
        })
    }
}
