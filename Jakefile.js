"use strict";

var fs = require("fs");
var ju = require("./jakeutil")
var os = require("os")
var path = require("path")
var expand = ju.expand;
var cmdIn = ju.cmdIn;
var strpSrcMap = ju.strpSrcMap;

function tscIn(task, dir, builtDir) {
    let command = 'node ' + path.relative(dir, './node_modules/typescript/bin/tsc')
    if (process.env.sourceMaps === 'true') {
        command += ' --sourceMap --mapRoot file:///' + path.resolve(builtDir)
        if (process.env.PXT_ENV != 'production') {
            // In development, dump the sources inline
            command += ' --inlineSourceMap --inlineSources'
        }
    }
    cmdIn(task, dir, command)
}

function compileDir(name, deps) {
    if (!deps) deps = []
    let dd = expand([name].concat(deps))
    let out = 'built/' + name + '.js';
    file(out, dd, { async: true }, function () {
        tscIn(this, name, "built")
    })
}

function loadText(filename) {
    return fs.readFileSync(filename, "utf8");
}

function setupTest(taskName, testFolder, testFile) {
    task(taskName, ['built/tests/' + testFolder + '/runner.js'], { async: true }, function () {
        const args = " built/tests/" + testFolder + "/runner.js --reporter dot";
        if (os.platform() === "win32") {
            cmdIn(this, ".", path.resolve("node_modules/.bin/mocha.cmd") + args)
        }
        else {
            cmdIn(this, ".", "./node_modules/.bin/mocha" + args)
        }
    })

    file("built/tests/" + testFolder + "/" + testFile, ['default'], { async: true }, function () {
        cmdIn(this, "tests/" + testFolder, 'node ../../node_modules/typescript/bin/tsc')
    });

    ju.catFiles('built/tests/' + testFolder + '/runner.js', [
        "node_modules/typescript/lib/typescript.js",
        "built/pxtlib.js",
        "built/pxtcompiler.js",
        "built/pxtpy.js",
        "built/pxtsim.js",
        "built/tests/" + testFolder + "/" + testFile,
    ],
        `
    "use strict";
    // make sure TypeScript doesn't overwrite our module.exports
    global.savedModuleExports = module.exports;
    module.exports = null;
    `, ['built/pxt-common.json']);
}

function runKarma(that, flags) {
    var command;
    if (os.platform() === 'win32') {
        command = "karma.cmd start ../../karma.conf.js " + flags;
    }
    else {
        command = "./karma start ../../karma.conf.js " + flags;
    }
    cmdIn(that, "node_modules/.bin", command);
}

task('default', ['updatestrings', 'built/pxt.js', 'built/pxt.d.ts', 'built/pxtrunner.js', 'built/backendutils.js', 'built/target.js', 'wapp', 'monaco-editor', 'built/web/pxtweb.js', 'built/tests/blocksrunner.js'], { parallelLimit: 10 })

task('test', ['default', 'testfmt', 'testerr', 'testdecompiler', 'testlang', 'karma'])

task('clean', function () {
    ["built", "temp"].forEach(d => {
        expand([d]).forEach(f => {
            try {
                fs.unlinkSync(f)
            } catch (e) {
                console.log("cannot unlink:", f, e.message)
            }
        })
        jake.rmRf(d)
    })
})

setupTest('testdecompiler', 'decompile-test', 'decompilerunner.js')
setupTest('testlang', 'compile-test', 'compilerunner.js')
setupTest('testerr', 'errors-test', 'errorrunner.js')
setupTest('testfmt', 'format-test', 'formatrunner.js')
setupTest('testpydecompiler', 'pydecompile-test', 'pydecompilerunner.js')


task('testpkgconflicts', ['built/pxt.js'], { async: true }, function () {
    cmdIn(this, "tests/pkgconflicts", 'node ../../built/pxt.js testpkgconflicts')
})

ju.catFiles('built/pxt.js', [
    "node_modules/typescript/lib/typescript.js",
    "built/pxtlib.js",
    "built/pxtcompiler.js",
    "built/pxtpy.js",
    "built/pxtsim.js",
    "built/cli.js"
],
    `
"use strict";
// make sure TypeScript doesn't overwrite our module.exports
global.savedModuleExports = module.exports;
module.exports = null;
`, ['built/pxt-common.json'])

file('built/nodeutil.js', ['built/cli.js'])
file('built/pxt.d.ts', ['built/cli.js'], function () {
    jake.cpR("built/cli.d.ts", "built/pxt.d.ts")
})
file('built/target.js', ['built/pxt.js'], { async: true }, function () {
    cmdIn(this, ".", "node built/pxt.js buildtarget");
})
file('built/typescriptServices.d.ts', ['node_modules/typescript/lib/typescriptServices.d.ts'], function () {
    if (!fs.existsSync("built")) fs.mkdirSync("built");
    jake.cpR('node_modules/typescript/lib/typescriptServices.d.ts', "built/")
})

file('built/pxt-common.json', expand(['libs/pxt-common'], ".ts"), function () {
    console.log(`[${this.name}]`)
    let std = {}
    for (let f of this.prereqs) {
        std[path.basename(f)] = fs.readFileSync(f, "utf8")
    }
    fs.writeFileSync(this.name, JSON.stringify(std, null, 4))
})

compileDir("pxtlib", "built/typescriptServices.d.ts")
compileDir("pxtcompiler", ["built/pxtlib.js"])
compileDir("pxtpy", ["built/pxtcompiler.js"])
compileDir("pxtwinrt", ["built/pxtlib.js"])
compileDir("pxtblocks", ["built/pxtlib.js", "built/pxtsim.js", "built/pxtcompiler.js"])
ju.catFiles("built/pxtblockly.js", expand(["webapp/public/blockly/blockly_compressed.js", "webapp/public/blockly/blocks_compressed.js", "webapp/public/blockly/msg/js/en.js", "built/pxtblocks.js"]), "")
compileDir("pxtrunner", ["built/pxtlib.js", "built/pxteditor.js", "built/pxtcompiler.js", "built/pxtsim.js", "built/pxtblockly.js"])
compileDir("pxtsim", ["built/pxtlib.js"])
compileDir("pxteditor", ["built/pxtlib.js", "built/pxtblockly.js"])
compileDir("cli", ["built/pxtlib.js", "built/pxtsim.js", "built/pxtcompiler.js", "built/pxtpy.js"])
compileDir("backendutils", ['pxtlib/commonutil.ts', 'pxtlib/docsrender.ts'])
file("built/web/pxtweb.js", expand(["docfiles/pxtweb"]), { async: true }, function () { tscIn(this, "docfiles/pxtweb", "built") })

task("karma", ["blocklycompilertest"], function () {
    runKarma(this, "");
});

task("karma-debug", ["blocklycompilertest"], function () {
    runKarma(this, "--no-single-run");
});

task("blocklycompilertest", ["default"], { async: true }, function () {
    cmdIn(this, "tests/blocklycompiler-test", "node ../../node_modules/typescript/bin/tsc")
})

file("built/tests/blocksrunner.js", ["built/pxtlib.js", "built/pxtcompiler.js", "built/pxtblocks.js", "built/pxteditor.js"], { async: true }, function () {
    cmdIn(this, "tests/blocks-test", "node ../../node_modules/typescript/bin/tsc")
})

task("travis", ["lint", "test", "upload"])

task('upload', ["wapp", "built/pxt.js", "built/tests/blocksrunner.js"], { async: true }, function () {
    jake.exec([
        "node built/pxt.js travis",
        "node built/pxt.js buildtarget"
    ], { printStdout: true }, complete.bind(this));
})

task('downloadcrowdin', ["built/pxt.js"], { async: true }, function () {
    jake.exec([
        "node built/pxt.js crowdin download strings.json webapp/public/locales"
    ], { printStdout: true }, complete.bind(this));
})

task("lint", [], { async: true }, function () {
    console.log('linting...')
    jake.exec([
        "cli",
        "pxtblocks",
        "pxteditor",
        "pxtlib",
        "pxtcompiler",
        "pxtpy",
        "pxtrunner",
        "pxtsim",
        "pxtwinrt",
        "webapp",
        "docfiles/pxtweb"]
        .map(function (d) { return "node node_modules/tslint/bin/tslint --project ./" + d + "/tsconfig.json" })
        , { printStdout: true }, function () {
            console.log('linted.');
            complete();
        });
})

task('bump', function () {
    jake.exec([
        "node built/pxt.js bump",
    ], { printStdout: true });
})

task('update', function () {
    jake.exec([
        "git pull",
        "npm install"
    ], { printStdout: true });
})

task('updatestrings', ['built/localization.json'])


file('built/localization.json', ju.expand1(
    ["pxtlib",
        "pxtblocks",
        "pxtblocks/fields",
        "webapp/src"]
), function () {
    var errCnt = 0;
    var translationStrings = {}
    var translationHelpStrings = {}

    function processLf(filename) {
        if (!/\.(ts|tsx|html)$/.test(filename)) return
        if (/\.d\.ts$/.test(filename)) return

        //console.log('extracting strings from %s', filename);
        loadText(filename).split('\n').forEach((line, idx) => {
            function err(msg) {
                console.log("%s(%d): %s", filename, idx, msg);
                errCnt++;
            }

            while (true) {
                var newLine = line.replace(/\blf(_va)?\s*\(\s*(.*)/, (all, a, args) => {
                    var m = /^("([^"]|(\\"))+")\s*[\),]/.exec(args)
                    if (m) {
                        try {
                            var str = JSON.parse(m[1])
                            translationStrings[str] = 1
                        } catch (e) {
                            err("cannot JSON-parse " + m[1])
                        }
                    } else {
                        if (!/util\.ts$/.test(filename))
                            err("invalid format of lf() argument: " + args)
                    }
                    return "BLAH " + args
                })
                if (newLine == line) return;
                line = newLine
            }
        })
    }

    var fileCnt = 0;
    this.prereqs.forEach(pth => {
        fileCnt++;
        processLf(pth);
    });

    Object.keys(translationHelpStrings).forEach(k => translationStrings[k] = k)
    var tr = Object.keys(translationStrings)
    tr.sort()

    if (!fs.existsSync("built")) fs.mkdirSync("built");
    fs.writeFileSync("built/localization.json", JSON.stringify({ strings: tr }, null, 1))
    var strings = {};
    tr.forEach(function (k) { strings[k] = k; });
    fs.writeFileSync("built/strings.json", JSON.stringify(strings, null, 2));

    console.log("Localization extraction: " + fileCnt + " files; " + tr.length + " strings");
    if (errCnt > 0)
        console.log("%d errors", errCnt);
})

task('wapp', [
    "built/web/pxtlib.js",
    "built/web/pxtcompiler.js",
    "built/web/pxtpy.js",
    "built/web/pxtsim.js",
    "built/web/pxtblockly.js",
    "built/web/pxteditor.js",
    "built/web/pxtwinrt.js",
    'built/web/main.js',
    'built/web/pxtapp.js',
    'built/web/pxtworker.js',
    'built/web/pxtembed.js',
    'built/web/worker.js',
    'built/web/fonts/icons.woff2',
    'built/web/icons.css',
    'built/web/blockly.css',
    'built/web/semantic.css',
    "built/web/semantic.js",
    "docs/playground.html"
])

file("built/web/pxtlib.js", [
    "built/pxtlib.js",
    "built/pxtcompiler.js",
    "built/pxtpy.js",
    "built/pxtblockly.js",
    "built/pxtsim.js",
    "built/pxtrunner.js",
    "built/pxteditor.js",
    "built/pxtwinrt.js"
], function () {
    jake.mkdirP("built/web")
    jake.cpR("node_modules/jquery/dist/jquery.min.js", "built/web/jquery.js")
    jake.cpR("node_modules/bluebird/js/browser/bluebird.min.js", "built/web/bluebird.min.js")
    jake.cpR("node_modules/applicationinsights-js/dist/ai.0.js", "built/web/ai.0.js")

    jake.cpR("built/pxtlib.js", "built/web/")
    jake.cpR("built/pxtcompiler.js", "built/web/")
    jake.cpR("built/pxtpy.js", "built/web/")
    jake.cpR("built/pxtblocks.js", "built/web/")
    jake.cpR("built/pxtblockly.js", "built/web/")
    jake.cpR("built/pxtsim.js", "built/web/")
    jake.cpR("built/pxtrunner.js", "built/web/")
    jake.cpR("built/pxteditor.js", "built/web/")
    jake.cpR("built/pxtwinrt.js", "built/web/")
    jake.cpR("external/tdast.js", "built/web/")

    let additionalExports = [
        "getCompletionData"
    ]

    let ts = fs.readFileSync("node_modules/typescript/lib/typescript.js", "utf8")
    ts = ts.replace(/getCompletionsAtPosition: getCompletionsAtPosition,/,
        f => f + " " + additionalExports.map(s => s + ": ts.Completions." + s + ",").join(" "))
    fs.writeFileSync("built/web/typescript.js", ts)
})


task('monaco-editor', [
    "built/web/vs/editor/editor.main.js",
    "built/web/vs/language/typescript/src/mode.js"
])


task('serve', ['default'], { async: true }, function () {
    let cmdArg = '';
    if (process.env.sourceMaps === 'true') {
        cmdArg = '-include-source-maps'
    }
    else if (process.env.noBrowser === 'true') {
        cmdArg = '-no-browser'
    }
    else if (process.env.localYotta === 'true') {
        cmdArg = '-yt'
    }
    else if (process.env.cloud === 'true') {
        cmdArg = '-cloud'
    }
    else if (process.env.justServe === 'true') {
        cmdArg = '-just'
    }
    else if (process.env.packaged === 'true') {
        cmdArg = '-pkg'
    }
    if (process.env.browser) {
        cmdArg += ' -browser ' + process.env.browser;
    }

    let destination = '../pxt-microbit';
    if (process.env.target) {
        destination = '../' + process.env.target;
    }
    cmdIn(this, destination, 'node ../pxt/built/pxt.js serve ' + cmdArg)
})

file('built/web/vs/editor/editor.main.js', ['node_modules/pxt-monaco-typescript/release/src/monaco.contribution.js'], function () {
    console.log(`Updating the monaco editor bits`)
    jake.mkdirP("built/web/vs/editor")
    let monacotypescriptcontribution = fs.readFileSync("node_modules/pxt-monaco-typescript/release/src/monaco.contribution.js", "utf8")
    monacotypescriptcontribution = monacotypescriptcontribution.replace(/\[\"require\"\,\s*\"exports\"\]/, '["require","exports","vs/editor/edcore.main"]')

    let monacoeditor = fs.readFileSync("node_modules/monaco-editor/dev/vs/editor/editor.main.js", "utf8")
    // Remove certain actions from the context menu
    monacoeditor = monacoeditor.replace(/((GoToDefinitionAction|'editor.action.(changeAll|quickOutline|previewDeclaration|referenceSearch.trigger)')[.\s\S]*?)(menuOpts:[.\s\S]*?})/gi, '$1')
    monacoeditor = monacoeditor.replace(/.*define\(\"vs\/language\/typescript\/src\/monaco.contribution\",.*/gi, `${monacotypescriptcontribution}`)
    // Fix for android keyboard issues:
    // Issue 1: getClientRects issue on Android 5.1 (Chrome 40), monaco-editor/#562
    monacoeditor = monacoeditor.replace(/FloatHorizontalRange\(Math\.max\(0, clientRect\.left - clientRectDeltaLeft\), clientRect\.width\)/gi,
        `FloatHorizontalRange(Math.max(0, clientRect.right - clientRectDeltaLeft), clientRect.width)`)
    // Issue 2: Delete key is a composition input on Android 6+, monaco-editor/#563
    monacoeditor = monacoeditor.replace(/if \(typeInput\.text !== ''\)/gi,
        `if (typeInput.text !== '' || (typeInput.text === '' && typeInput.replaceCharCnt == 1))`)
    // Issue 3: Gboard on Android ignores the autocomplete field, and so I'm disabling composition updates on keyboards that support it.
    monacoeditor = monacoeditor.replace(/exports\.isChromev56 = \(userAgent\.indexOf\('Chrome\/56\.'\) >= 0/gi,
        `exports.isAndroid = (userAgent.indexOf('Android') >= 0);\n    exports.isChromev56 = (userAgent.indexOf('Chrome/56.') >= 0`)
    monacoeditor = monacoeditor.replace(/var newState = _this\._textAreaState\.readFromTextArea\(_this\._textArea\);/gi,
        `var newState = _this._textAreaState.readFromTextArea(_this._textArea);\n                if (browser.isAndroid) newState.selectionStart = newState.selectionEnd;`)
    monacoeditor = monacoeditor.replace(/_this\._register\(dom\.addDisposableListener\(textArea\.domNode, 'compositionstart', function \(e\) {/gi,
        `_this._register(dom.addDisposableListener(textArea.domNode, 'compositionstart', function (e) {\n                if (browser.isAndroid) return;`)
    monacoeditor = monacoeditor.replace(/_this\._register\(dom\.addDisposableListener\(textArea\.domNode, 'compositionupdate', function \(e\) {/gi,
        `_this._register(dom.addDisposableListener(textArea.domNode, 'compositionupdate', function (e) {\n                if (browser.isAndroid) return;`)
    monacoeditor = monacoeditor.replace(/_this\._register\(dom\.addDisposableListener\(textArea\.domNode, 'compositionend', function \(e\) {/gi,
        `_this._register(dom.addDisposableListener(textArea.domNode, 'compositionend', function (e) {\n                if (browser.isAndroid) return;`)
    fs.writeFileSync("built/web/vs/editor/editor.main.js", monacoeditor)

    jake.mkdirP("webapp/public/vs")
    jake.cpR("node_modules/monaco-editor/min/vs/base", "webapp/public/vs/")
    jake.cpR("node_modules/monaco-editor/min/vs/editor", "webapp/public/vs/")
    fs.unlinkSync("webapp/public/vs/editor/editor.main.js")

    jake.cpR("node_modules/monaco-editor/min/vs/loader.js", "webapp/public/vs/")
    jake.mkdirP("webapp/public/vs/basic-languages/src")
    jake.cpR("node_modules/monaco-editor/min/vs/basic-languages/src/bat.js", "webapp/public/vs/basic-languages/src/")
    jake.cpR("node_modules/monaco-editor/min/vs/basic-languages/src/cpp.js", "webapp/public/vs/basic-languages/src/")
    jake.cpR("node_modules/monaco-editor/min/vs/basic-languages/src/markdown.js", "webapp/public/vs/basic-languages/src/")
    jake.cpR("node_modules/monaco-editor/min/vs/basic-languages/src/python.js", "webapp/public/vs/basic-languages/src/")
    jake.mkdirP("webapp/public/vs/language/json")
    jake.cpR("node_modules/monaco-editor/min/vs/language/json/", "webapp/public/vs/language/")

    // Strip out the sourceMappingURL= from each of the monaco files (recursively)
    strpSrcMap(this, "webapp/public/vs/")
})

file('built/web/vs/language/typescript/src/mode.js', ['node_modules/pxt-monaco-typescript/release/src/mode.js'], function () {
    console.log(`Updating the monaco typescript language service`)
    jake.mkdirP("built/web/vs/language/typescript/src")
    jake.mkdirP("built/web/vs/language/typescript/lib")
    jake.cpR("node_modules/pxt-monaco-typescript/release/lib/typescriptServices.js", "built/web/vs/language/typescript/lib/")
    jake.cpR("node_modules/pxt-monaco-typescript/release/src/mode.js", "built/web/vs/language/typescript/src/")
    jake.cpR("node_modules/pxt-monaco-typescript/release/src/worker.js", "built/web/vs/language/typescript/src/")
})

file('built/webapp/src/app.js', expand([
    "webapp",
    "built/web/pxtlib.js",
    "built/web/pxtsim.js",
    "built/web/pxtblockly.js",
    "built/web/pxteditor.js",
    "built/web/pxtwinrt.js"
]), { async: true }, function () {
    tscIn(this, "webapp", "built/webapp")
})

file('built/web/main.js', ["built/web/pxtapp.js", "built/webapp/src/app.js"], { async: true }, function () {
    if (process.env.PXT_ENV == 'production') {
        cmdIn(this, ".", 'node node_modules/browserify/bin/cmd ./built/webapp/src/app.js -g ' +
            '[ envify --NODE_ENV production ] -g uglifyify -o ./built/web/main.js')
    } else {
        cmdIn(this, ".", 'node node_modules/browserify/bin/cmd built/webapp/src/app.js -o built/web/main.js --debug')
    }
})

ju.catFiles('built/web/pxtapp.js', [
    "node_modules/lzma/src/lzma_worker-min.js",
    "built/web/pxtlib.js",
    "built/web/pxtwinrt.js",
    "built/web/pxteditor.js",
    "built/web/pxtsim.js"
])

file('built/web/worker.js', ["built/webapp/src/app.js"], function () {
    jake.cpR("built/webapp/src/worker.js", "built/web/")
})

ju.catFiles('built/web/pxtworker.js', [
    "built/web/typescript.js",
    "node_modules/fuse.js/dist/fuse.min.js",
    "node_modules/lzma/src/lzma_worker-min.js",
    "built/web/pxtlib.js",
    "built/web/pxtcompiler.js",
    "built/web/pxtpy.js"
], `"use strict";`, ["built/webapp/src/app.js"]);

ju.catFiles('built/web/pxtembed.js', [
    "built/web/typescript.js",
    "node_modules/lzma/src/lzma_worker-min.js",
    "built/web/pxtlib.js",
    "built/web/pxtcompiler.js",
    "built/web/pxtpy.js",
    "built/web/pxtblockly.js",
    "built/web/pxteditor.js",
    "built/web/pxtsim.js",
    "built/web/pxtrunner.js"
]);

file('built/web/fonts/icons.woff2', [], function () {
    jake.cpR("node_modules/semantic-ui-less/themes/default/assets/fonts", "built/web/")
})

file('built/web/blockly.css', ['built/pxt.js',
    "theme/blockly.less", "theme/theme.config", "theme/themes/pxt/globals/site.variables"
], { async: true }, function () {
    cmdIn(this, ".", 'node built/pxt.js buildcss')
})

file('built/web/semantic.css', ['built/pxt.js',
    "theme/style.less", "theme/theme.config", "theme/themes/pxt/globals/site.variables"
], { async: true }, function () {
    cmdIn(this, ".", 'node built/pxt.js buildcss')
})

file('built/web/icons.css', expand(["svgicons"]), { async: true }, function () {
    let webfontsGenerator = require('webfonts-generator')
    let name = "xicon"
    let task = this

    webfontsGenerator({
        fontName: name,
        files: expand(["svgicons"], ".svg"),
        dest: "built/fonts/", // fake
        templateOptions: {
            classPrefix: name + ".",
            baseClass: name
        },
        // The following icons have fixed code points because they are referenced in the code
        codepoints: {
            function: 0xf109,
            bucket: 0xf102,
            undo: 0xf118,
            redo: 0xf111
        },
        writeFiles: false,
    }, function (error, res) {
        if (error) {
            task.fail(error)
        } else {
            let css = res.generateCss()
            let data = res["woff"].toString("base64")
            css = css.replace(/^\s*src:[^;]+;/m,
                "    src: url(data:application/x-font-woff;charset=utf-8;base64," + data + ") format(\"woff\");")
            css = css.replace(/line-height:\s*1;/, "")
            // SUI css file would override our icons without !important;
            // our icons have xicon class so it never happens the other way around
            css = css.replace(/(content:.*);/g, (f, m) => m + " !important;")
            console.log("Generated icons.css -", css.length, "bytes")
            let html = "<!doctype html>\n<html><body style='font-size: 30px'><style>@import './icons.css';</style>\n"
            css.replace(/\.(\w+):before /g, (f, n) => {
                html += `<div style="margin:20px;"> <i class="${name} ${n}"></i> <span style='padding-left:1em; font-size:0.8em; opacity:0.5;'>${n}</span> </div>\n`
            })
            html += "</body></html>\n"
            fs.writeFileSync("built/web/icons.html", html)
            fs.writeFileSync("built/web/icons.css", css)
            task.complete()
        }
    })
})

ju.catFiles("built/web/semantic.js",
    expand(["node_modules/semantic-ui-less/definitions/globals",
        "node_modules/semantic-ui-less/definitions/modules/accordion.js",
        "node_modules/semantic-ui-less/definitions/modules/checkbox.js",
        "node_modules/semantic-ui-less/definitions/modules/dimmer.js",
        "node_modules/semantic-ui-less/definitions/modules/dropdown.js",
        "node_modules/semantic-ui-less/definitions/modules/embed.js",
        "node_modules/semantic-ui-less/definitions/modules/modal.js",
        "node_modules/semantic-ui-less/definitions/modules/popup.js",
        "node_modules/semantic-ui-less/definitions/modules/search.js",
        "node_modules/semantic-ui-less/definitions/modules/sidebar.js",
        "node_modules/semantic-ui-less/definitions/modules/transition.js",
        "node_modules/semantic-ui-less/definitions/behaviors"], ".js"),
    "")

file('docs/playground.html', ['built/web/pxtworker.js', 'built/web/pxtblockly.js', 'built/web/semantic.css'], function () {
    jake.cpR("libs/pxt-common/pxt-core.d.ts", "docs/static/playground/pxt-common/pxt-core.d.js");
    jake.cpR("libs/pxt-common/pxt-helpers.ts", "docs/static/playground/pxt-common/pxt-helpers.js");
    jake.cpR("webapp/public/blockly/media/", "docs/static/playground/blockly/");
})
