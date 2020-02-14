const WEBAPP_CACHE = "makecode-site-cache-v1";

// All caches outside this list are deleted on activation
const allCaches = [
    WEBAPP_CACHE
];


interface ServiceWorkerEvent extends Event {
    waitUntil<U>(promise: Promise<U>): void;
    respondWith(response: Promise<Response>): void;
    request: Request;
}

const webappUrls = [
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
];

// These tags are all replaced by the server. Some of them are newline
// separated lists, some of them are single line urls
const serverReplacedUrls = `
@targetFieldEditorsJs@
@targetEditorJs@
@defaultLocaleStrings@
@monacoworkerjs@
@workerjs@
@targetImages@
@cachedHexFiles@
`.split("\n").map(url => url.trim()).filter(url => !!url)

self.addEventListener("install", (ev: ServiceWorkerEvent) => {
    console.log("Installing service worker...")
    ev.waitUntil(caches.open(WEBAPP_CACHE)
        .then(cache => {
            console.log("Opened cache")
            return cache.addAll(webappUrls.concat(serverReplacedUrls));
        }))
});

self.addEventListener("activate", (ev: ServiceWorkerEvent) => {
    // Clean up any caches that no longer exist
    ev.waitUntil(caches.keys()
        .then(cacheNames => Promise.all(
            cacheNames.map(name => allCaches.indexOf(name) === -1 ? caches.delete(name) : Promise.resolve())
        )))
});

self.addEventListener("fetch", (ev: ServiceWorkerEvent) => {
    ev.respondWith(caches.match(ev.request)
        .then(response => {
            return response || fetch(ev.request)
        }))
});