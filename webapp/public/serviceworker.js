var CACHE_NAME = 'pxt-cache-v2';



// keep in sync with release.manifest
var urlsToCache = [
  // docs
  '/doccdn/jquery.js',
  '/doccdn/semantic.css',
  '/doccdn/blockly.css',
  '/docfiles/docs.js',
  '/docfiles/target.js',
  '/docfiles/style.css',
  '/docfiles/target.css',
  '/docfiles/vs.css',
  '/--embed',
  "https://az742082.vo.msecnd.net/pub/psopafpj",

  // editor
  "/blb/semantic.js",
  "/blb/main.js",
  "/blb/typescript.js",
  "/blb/marked/marked.min.js",
  "/blb/highlight.js/highlight.pack.js",
  "/blb/lzma/lzma_worker-min.js",
  "/blb/fuse.min.js",
  "/blb/jquery.js",
  "/blb/pxtlib.js",
  "/blb/pxtcompiler.js",
  "/blb/pxtblocks.js",
  "/blb/pxtwinrt.js",
  "/blb/pxteditor.js",
  "/blb/pxtsim.js",
  "/blb/blockly.css",
  "/blb/semantic.css",
  "/blb/rtlsemantic.css",
  "/blb/custom.css",
  "/blb/icons.css",
  "@defaultLocaleStrings@",
  "@cachedHexFilesArray@",
  "@targetEditorJs@",

  // Blockly
  "/blb/blockly/blockly_compressed.js",
  "/blb/blockly/blocks_compressed.js",
  "/blb/blockly/msg/js/en.js",
  "/cdn/blockly/media/sprites.png",
  "/cdn/blockly/media/click.mp3",
  "/cdn/blockly/media/disconnect.wav",
  "/cdn/blockly/media/delete.mp3",

  // monaco
  "/blb/vs/loader.js",
  "/blb/vs/base/worker/workerMain.js",
  "/blb/vs/basic-languages/src/bat.js",
  "/blb/vs/basic-languages/src/cpp.js",
  "/blb/vs/editor/editor.main.css",
  "/blb/vs/editor/editor.main.js",
  "/blb/vs/editor/editor.main.nls.js",
  "/blb/vs/language/json/jsonMode.js",
  "/blb/vs/language/json/jsonWorker.js",
  "/blb/vs/language/typescript/lib/typescriptServices.js",
  "/blb/vs/language/typescript/src/mode.js",
  "/blb/vs/language/typescript/src/worker.js",

  // AI
  "https://az416426.vo.msecnd.net/scripts/a/ai.0.js"
];

self.addEventListener('install', function (event) {
  // Perform install step:  loading each required file into cache
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // Add all offline dependencies to the cache
      return cache.addAll(urlsToCache);
    })
    .then(function() {
      // At this point everything has been cached
      return self.skipWaiting();
    })
  );
})
self.addEventListener('activate', function(event) {
  var cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function () {
      // Calling claim() to force a "controllerchange" event on navigator.serviceWorker
      event.waitUntil(self.clients.claim());
    })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    (event.request.url.indexOf('/api/') >= 0) ?
      fetch(event.request)
    : caches.match(event.request).then(function (response) {
      // Cache hit - return response
      if (response) {
        console.log("Cache response hit")
        console.log(response);
        return response;
      }
      // IMPORTANT: Clone the request. A request is a stream and
      // can only be consumed once. Since we are consuming this
      // once by cache and once by the browser for fetch, we need
      // to clone the response.
      var fetchRequest = event.request.clone();
      
      return fetch(fetchRequest).then(
        function(response) {
          // Check if we received a valid response
          if(!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // IMPORTANT: Clone the response. A response is a stream
          // and because we want the browser to consume the response
          // as well as the cache consuming the response, we need
          // to clone it so we have two streams.
          var responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(function(cache) {
              cache.put(event.request, responseToCache);
            });

          return response;
        }
      ).catch(function () {
        console.log("failed with request.. ")
        console.log(event.request)
        if (event.request.url.indexOf('/api/') >= 0) {
          console.log("Trying to find API")
        }
      });
    })
  );
});

// v1