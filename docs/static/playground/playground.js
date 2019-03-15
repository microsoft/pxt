/// <reference path="../../../node_modules/monaco-editor/monaco.d.ts" />

(function () {

    'use strict';

    window.onload = function () {
        require(['vs/editor/editor.main'], function () {
            monaco.languages.typescript.javascriptDefaults.addExtraLib([
                'declare var require: {',
                '	toUrl(path: string): string;',
                '	(moduleName: string): any;',
                '	(dependencies: string[], callback: (...args: any[]) => any, errorback?: (err: any) => void): any;',
                '	config(data: any): any;',
                '	onError: Function;',
                '};',
            ].join('\n'), 'require.d.ts');

            var loading = document.getElementById('loading');
            loading.parentNode.removeChild(loading);
            load();

        });
    };

    var editor = null;
    var data = {
        js: {
            model: null,
            state: null
        },
        css: {
            model: null,
            state: null
        },
        html: {
            model: null,
            state: null
        }
    };

    function load() {

        function layout() {
            var GLOBAL_PADDING = 20;

            var WIDTH = window.innerWidth - 2 * GLOBAL_PADDING;
            var HEIGHT = window.innerHeight;

            var TITLE_HEIGHT = 110;
            var FOOTER_HEIGHT = 80;
            var TABS_HEIGHT = 20;
            var INNER_PADDING = 20;
            var SWITCHER_HEIGHT = 30;

            var HALF_WIDTH = Math.floor((WIDTH - INNER_PADDING) / 2);
            var REMAINING_HEIGHT = HEIGHT - TITLE_HEIGHT - FOOTER_HEIGHT - SWITCHER_HEIGHT;

            playgroundContainer.style.width = WIDTH + 'px';
            playgroundContainer.style.height = (HEIGHT - FOOTER_HEIGHT) + 'px';

            sampleSwitcher.style.position = 'absolute';
            sampleSwitcher.style.top = TITLE_HEIGHT + 'px';
            sampleSwitcher.style.left = GLOBAL_PADDING + 'px';

            typingContainer.style.position = 'absolute';
            typingContainer.style.top = GLOBAL_PADDING + TITLE_HEIGHT + SWITCHER_HEIGHT + 'px';
            typingContainer.style.left = GLOBAL_PADDING + 'px';
            typingContainer.style.width = HALF_WIDTH + 'px';
            typingContainer.style.height = REMAINING_HEIGHT + 'px';

            tabArea.style.position = 'absolute';
            tabArea.style.boxSizing = 'border-box';
            tabArea.style.top = 0;
            tabArea.style.left = 0;
            tabArea.style.width = HALF_WIDTH + 'px';
            tabArea.style.height = TABS_HEIGHT + 'px';

            editorContainer.style.position = 'absolute';
            editorContainer.style.boxSizing = 'border-box';
            editorContainer.style.top = TABS_HEIGHT + 'px';
            editorContainer.style.left = 0;
            editorContainer.style.width = HALF_WIDTH + 'px';
            editorContainer.style.height = (REMAINING_HEIGHT - TABS_HEIGHT) + 'px';

            if (editor) {
                editor.layout({
                    width: HALF_WIDTH - 2,
                    height: (REMAINING_HEIGHT - TABS_HEIGHT) - 1
                });
            }

            runContainer.style.position = 'absolute';
            runContainer.style.top = GLOBAL_PADDING + TITLE_HEIGHT + SWITCHER_HEIGHT + TABS_HEIGHT + 'px';
            runContainer.style.left = GLOBAL_PADDING + INNER_PADDING + HALF_WIDTH + 'px';
            runContainer.style.width = HALF_WIDTH + 'px';
            runContainer.style.height = (REMAINING_HEIGHT - TABS_HEIGHT) + 'px';

            runIframeHeight = (REMAINING_HEIGHT - TABS_HEIGHT);
            if (runIframe) {
                runIframe.style.height = runIframeHeight + 'px';
            }
        }

        function changeTab(selectedTabNode, desiredModelId) {
            for (var i = 0; i < tabArea.childNodes.length; i++) {
                var child = tabArea.childNodes[i];
                if (/tab/.test(child.className)) {
                    child.className = 'tab';
                }
            }
            selectedTabNode.className = 'tab active';

            var currentState = editor.saveViewState();

            var currentModel = editor.getModel();
            if (currentModel === data.js.model) {
                data.js.state = currentState;
            }

            editor.setModel(data[desiredModelId].model);
            editor.restoreViewState(data[desiredModelId].state);
            editor.focus();
        }


        // create the typing side
        var typingContainer = document.createElement('div');
        typingContainer.className = 'typingContainer';

        var tabArea = (function () {
            var tabArea = document.createElement('div');
            tabArea.className = 'tabArea';

            var jsTab = document.createElement('span');
            jsTab.className = 'tab active';
            jsTab.appendChild(document.createTextNode('TypeScript'));
            jsTab.onclick = function () { changeTab(jsTab, 'js'); };
            tabArea.appendChild(jsTab);

            var runBtn = document.createElement('span');
            runBtn.className = 'action run';
            runBtn.appendChild(document.createTextNode('Run'));
            runBtn.onclick = function () { run(); };
            tabArea.appendChild(runBtn);

            return tabArea;
        })();

        var editorContainer = document.createElement('div');
        editorContainer.className = 'editor-container';

        typingContainer.appendChild(tabArea);
        typingContainer.appendChild(editorContainer);

        var runContainer = document.createElement('div');
        runContainer.className = 'run-container';

        var sampleSwitcher = document.createElement('select');
        var sampleChapter;
        PLAY_SAMPLES.forEach(function (sample) {
            if (!sampleChapter || sampleChapter.label !== sample.chapter) {
                sampleChapter = document.createElement('optgroup');
                sampleChapter.label = sample.chapter;
                sampleSwitcher.appendChild(sampleChapter);
            }
            var sampleOption = document.createElement('option');
            sampleOption.value = sample.id;
            sampleOption.appendChild(document.createTextNode(sample.name));
            sampleChapter.appendChild(sampleOption);
        });
        sampleSwitcher.className = 'sample-switcher';

        var LOADED_SAMPLES = [];
        function findLoadedSample(sampleId) {
            for (var i = 0; i < LOADED_SAMPLES.length; i++) {
                var sample = LOADED_SAMPLES[i];
                if (sample.id === sampleId) {
                    return sample;
                }
            }
            return null;
        }

        function findSamplePath(sampleId) {
            for (var i = 0; i < PLAY_SAMPLES.length; i++) {
                var sample = PLAY_SAMPLES[i];
                if (sample.id === sampleId) {
                    return sample.path;
                }
            }
            return null;
        }

        function loadSample(sampleId, callback) {
            var sample = findLoadedSample(sampleId);
            if (sample) {
                return callback(null, sample);
            }

            var samplePath = findSamplePath(sampleId);
            if (!samplePath) {
                return callback(new Error('sample not found'));
            }

            samplePath = 'static/playground/samples/' + samplePath;

            var js = xhr(samplePath + '/sample.js').then(function (response) { return response.responseText });
            js.then(function (_) {
                LOADED_SAMPLES.push({
                    id: sampleId,
                    js: _
                });
                return callback(null, findLoadedSample(sampleId));
            }, function (err) {
                callback(err, null);
            });
        }

        sampleSwitcher.onchange = function () {
            var sampleId = sampleSwitcher.options[sampleSwitcher.selectedIndex].value;
            window.location.hash = sampleId;
        };

        var playgroundContainer = document.getElementById('playground');

        layout();
        window.onresize = layout;

        playgroundContainer.appendChild(sampleSwitcher);
        playgroundContainer.appendChild(typingContainer);
        playgroundContainer.appendChild(runContainer);

        data.js.model = monaco.editor.createModel('console.log("hi")', 'typescript');

        editor = monaco.editor.create(editorContainer, {
            model: data.js.model,
            minimap: {
                enabled: false
            }
        });

        var autoRun = /autorun/.test(window.location.href);
        if (autoRun) {
            data.js.model.onDidChangeContent(function (e) {
                if (!e.isFlush) {
                    runDebounce();
                }
            });
        }

        var currentToken = 0;
        function parseHash(firstTime) {
            var sampleId = window.location.hash.replace(/^#/, '');
            if (!sampleId) {
                sampleId = PLAY_SAMPLES[0].id;
            }

            if (firstTime) {
                for (var i = 0; i < sampleSwitcher.options.length; i++) {
                    var opt = sampleSwitcher.options[i];
                    if (opt.value === sampleId) {
                        sampleSwitcher.selectedIndex = i;
                        break;
                    }
                }
            }

            var myToken = (++currentToken);
            loadSample(sampleId, function (err, sample) {
                if (err) {
                    alert('Sample not found! ' + err.message);
                    return;
                }
                if (myToken !== currentToken) {
                    return;
                }
                data.js.model.setValue(sample.js);
                editor.setScrollTop(0);
                run();
            });
        }
        window.onhashchange = parseHash;
        parseHash(true);

        function run() {
            doRun(runContainer);
        }

        var runDebounce = debounce(function() {
            run();
        }, 1000);
    }

    var runIframe = null, runIframeHeight = 0;
    function doRun(runContainer) {
        if (runIframe) {
            // Unload old iframe
            runContainer.removeChild(runIframe);
        }

        var getLang = function (lang) {
            return data[lang].model.getValue();
        };

        var commonPromise = xhr("/static/playground/pxt-common/pxt-core.d.js")
            .then(function (response) { return response.responseText });

        var helperPromise = xhr("/static/playground/pxt-common/pxt-helpers.js")
            .then(function (response) { return response.responseText });

        Promise.all([commonPromise, helperPromise]).then(function (all) {
            var common = all[0];
            var helpers = all[1];

            // Load new iframe
            runIframe = document.createElement('iframe');
            runIframe.id = 'runner';
            runIframe.src = 'playground-runner';
            runIframe.className = 'run-iframe';
            runIframe.style.boxSizing = 'border-box';
            runIframe.style.height = runIframeHeight + 'px';
            runIframe.style.width = '100%';
            runIframe.style.border = '1px solid lightgrey';
            runIframe.frameborder = '0';
            runContainer.appendChild(runIframe);

            runIframe.addEventListener('load', function (e) {
                var msg = {
                    js: getLang('js'),
                    common: common,
                    helpers: helpers
                }
                runIframe.contentWindow.postMessage(msg, "*");
            });

        });

    }

    var preloaded = {};
    (function () {
        var elements = Array.prototype.slice.call(document.querySelectorAll('pre[data-preload]'), 0);

        elements.forEach(function (el) {
            var path = el.getAttribute('data-preload');
            preloaded[path] = el.innerText || el.textContent;
            el.parentNode.removeChild(el);
        });
    })();

    function xhr(url) {
        if (preloaded[url]) {
            return Promise.resolve({
                responseText: preloaded[url]
            });
        }

        var req = null;
        return new Promise(function (resolve, reject) {
            req = new XMLHttpRequest();
            req.onreadystatechange = function () {
                if (req._canceled) { return; }

                if (req.readyState === 4) {
                    if ((req.status >= 200 && req.status < 300) || req.status === 1223) {
                        resolve(req);
                    } else {
                        reject(req);
                    }
                    req.onreadystatechange = function () { };
                }
            };

            req.open("GET", url, true);
            req.responseType = "";

            req.send(null);
        }, function () {
            req._canceled = true;
            req.abort();
        });
    }

    // Returns a function, that, as long as it continues to be invoked, will not
    // be triggered. The function will be called after it stops being called for
    // N milliseconds. If `immediate` is passed, trigger the function on the
    // leading edge, instead of the trailing.
    function debounce(func, wait, immediate) {
        var timeout;
        return function () {
            var context = this, args = arguments;
            var later = function () {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    };

})();