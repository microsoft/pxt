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
// Empty string for released, otherwise contains the ref or version path
const ref = `@relprefix@`.replace("---", "").replace(/^\//, "");
const pageUrl =  `@targetUrl@/` + ref;

// pxtRelId is replaced with the commit hash for this release
const refCacheName = "makecode;" + ref + ";@pxtRelId@";

initWebappServiceWorker();
initWebUSB();

function initWebappServiceWorker() {

    // We don't do offline for version paths, only named releases
    const isNamedEndpoint = ref.indexOf("/") === -1;

    const cdnUrl = `@cdnUrl@`;

    const webappUrls = [
        // The current page
        pageUrl,
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
        `/blb/ai.2.min.js`,

        // target
        `/blb/target.js`,

        // music editor icons
        `/blb/music-editor/apple.png`,
        `/blb/music-editor/burger.png`,
        `/blb/music-editor/cake.png`,
        `/blb/music-editor/car.png`,
        `/blb/music-editor/cat.png`,
        `/blb/music-editor/cherry.png`,
        `/blb/music-editor/clam.png`,
        `/blb/music-editor/computer.png`,
        `/blb/music-editor/crab.png`,
        `/blb/music-editor/dog.png`,
        `/blb/music-editor/duck.png`,
        `/blb/music-editor/egg.png`,
        `/blb/music-editor/explosion.png`,
        `/blb/music-editor/fish.png`,
        `/blb/music-editor/ice-cream.png`,
        `/blb/music-editor/lemon.png`,
        `/blb/music-editor/snake.png`,
        `/blb/music-editor/star.png`,
        `/blb/music-editor/strawberry.png`,
        `/blb/music-editor/taco.png`,
        `/blb/music-editor/bass-clef.svg`,
        `/blb/music-editor/treble-clef.svg`,

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
        ev.respondWith(handleFetch(ev));
    });

    async function handleFetch(ev: ServiceWorkerEvent): Promise<Response> {
        if (ev.request.url.startsWith(pageUrl)) {
            let path = ev.request.url.slice(pageUrl.length);
            if (path.startsWith("/")) path = path.slice(1);

            // If this is just the main page with a query parameter, attempt
            // to fetch from the network and fall back to the cache if it fails
            if (path.charAt(0) === "?") {
                let response: Response;
                try {
                    response = await fetch(ev.request);

                    // Store this response in the cache in case the user tries
                    // to visit this same query param offline
                    const cache = await caches.open(refCacheName);
                    cache.put(ev.request, response.clone());
                }
                catch (e) {
                    // Ignore
                }

                if (response) {
                    return response;
                }
                else {
                    console.warn(`Unable to fetch ${ev.request.url}, falling back to cache`);
                }
            }
        }

        // Check to see if it's in the cache
        const match = await caches.match(ev.request);

        if (match) return match;

        // Fall back to the network
        const response = fetch(ev.request);
        return response;
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
}


// The ServiceWorker manages the webUSB sharing between tabs/windows in the browser. Only
// one client can connect to webUSB at a time
function initWebUSB() {
    // Webusb doesn't love it when we connect/reconnect too quickly
    const minimumLockWaitTime = 4000;

    // The ID of the client who currently has the lock on webUSB
    let lockGranted: string;

    let lastLockTime = 0;
    let waitingLock: string;
    let state: "waiting" | "granting" | "idle" = "idle";
    let pendingDisconnectResolver: (resp: DisconnectResponse) => void;
    let statusResolver: (lock: string) => void;

    self.addEventListener("message", async (ev: MessageEvent) => {
        const message: pxt.ServiceWorkerClientMessage = ev.data;
        if (message?.type === "serviceworkerclient") {
            if (message.action === "request-packet-io-lock") {

                if (!lockGranted) lockGranted = await checkForExistingLockAsync();

                // Deny the lock if we are in the process of granting it to someone else
                if (state === "granting") {
                    await sendToAllClientsAsync({
                        type: "serviceworker",
                        action: "packet-io-lock-granted",
                        granted: false,
                        lock: message.lock
                    });
                    return;
                }

                console.log("Received lock request " + message.lock);

                // Throttle reconnect requests
                const timeSinceLastLock = Date.now() - lastLockTime;
                waitingLock = message.lock;
                if (timeSinceLastLock < minimumLockWaitTime) {
                    state = "waiting";
                    console.log("Waiting to grant lock request " + message.lock);
                    await delay(minimumLockWaitTime - timeSinceLastLock);
                }

                // We received a more recent request while we were waiting, so abandon this one
                if (waitingLock !== message.lock) {
                    console.log("Rejecting old lock request " + message.lock);
                    await sendToAllClientsAsync({
                        type: "serviceworker",
                        action: "packet-io-lock-granted",
                        granted: false,
                        lock: message.lock
                    });
                    return;
                }

                state = "granting";

                // First we need to tell whoever currently has the lock to disconnect
                // and poll until they have finished
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

                // Now we can notify that the request has been granted
                console.log("Granted lock request " + message.lock);
                lockGranted = message.lock;
                await sendToAllClientsAsync({
                    type: "serviceworker",
                    action: "packet-io-lock-granted",
                    granted: true,
                    lock: message.lock
                });

                lastLockTime = Date.now();
                state = "idle";
            }
            else if (message.action === "release-packet-io-lock") {
                // The client released the webusb lock for some reason (e.g. went to home screen)
                console.log("Received disconnect for " + lockGranted);
                lockGranted = undefined;
                if (pendingDisconnectResolver) pendingDisconnectResolver(DisconnectResponse.Disconnected);
            }
            else if (message.action === "packet-io-lock-disconnect") {
                // Response to a disconnect request we sent
                console.log("Received disconnect response for " + lockGranted);

                if (message.didDisconnect) lockGranted = undefined;
                if (pendingDisconnectResolver) pendingDisconnectResolver(message.didDisconnect ? DisconnectResponse.Disconnected : DisconnectResponse.Waiting);
            }
            else if (message.action === "packet-io-supported") {
                await sendToAllClientsAsync({
                    type: "serviceworker",
                    action: "packet-io-supported",
                    supported: true
                });
            }
            else if (message.action === "packet-io-status" && message.hasLock && statusResolver) {
                statusResolver(message.lock);
            }
        }
    });

    async function sendToAllClientsAsync(message: pxt.ServiceWorkerMessage) {
        const clients = await (self as unknown as ServiceWorkerScope).clients.matchAll()
        clients.forEach(c => c.postMessage(message))
    }

    // Waits for the disconnect and times-out after 5 seconds if there is no response
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
            }, 5000)
        });

        return Promise.race([ promise, timeoutPromise ])
            .then(resp => {
                clearTimeout(ref);
                pendingDisconnectResolver = undefined
                return resp;
            });
    }

    function checkForExistingLockAsync() {
        if (lockGranted) return Promise.resolve(lockGranted);
        let ref: any;

        const promise = new Promise<string>(resolve => {
            console.log("check for existing lock");
            statusResolver = resolve;
            sendToAllClientsAsync({
                type: "serviceworker",
                action: "packet-io-status"
            });
        })

        const timeoutPromise = new Promise<string>(resolve => {
            ref = setTimeout(() => {
                console.log("Timed-out check for existing lock");
                resolve(undefined);
            }, 1000)
        });

        return Promise.race([ promise, timeoutPromise ])
            .then(resp => {
                clearTimeout(ref);
                statusResolver = undefined
                return resp;
            });
    }


    function delay(millis: number): Promise<void> {
        return new Promise(resolve => {
            setTimeout(resolve, millis);
        });
    }
}
