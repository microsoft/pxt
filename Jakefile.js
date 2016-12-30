"use strict";

var fs = require("fs");
var ju = require("./jakeutil")
var path = require("path")
var expand = ju.expand;
var cmdIn = ju.cmdIn;
var strpSrcMap = ju.strpSrcMap;

function tscIn(task, dir, builtDir) {
    let command = 'node ../node_modules/typescript/bin/tsc'
    if (process.env.sourceMaps === 'true') {
        command += ' --sourceMap --mapRoot file:///' + path.resolve(builtDir)
    }
    cmdIn(task, dir, command)
}

function compileDir(name, deps) {
    if (!deps) deps = []
    let dd = expand([name].concat(deps))
    file('built/' + name + '.js', dd, { async: true }, function () { tscIn(this, name, "built") })
}

function loadText(filename) {
    return fs.readFileSync(filename, "utf8");
}

task('default', ['updatestrings', 'built/pxt.js', 'built/pxt.d.ts', 'built/pxtrunner.js', 'built/backendutils.js', 'wapp', 'monaco-editor'], { parallelLimit: 10 })

task('test', ['default', 'testfmt', 'testerr', 'testlang', 'testdecompiler', 'testdecompilererrors'])

task('clean', function () {
    expand(["built"]).forEach(f => {
        try {
            fs.unlinkSync(f)
        } catch (e) {
            console.log("cannot unlink:", f, e.message)
        }
    })
    jake.rmRf("built")
})

task('testfmt', ['built/pxt.js'], { async: true }, function () {
    cmdIn(this, "libs/format-test", 'node ../../built/pxt.js format -t')
})

task('testerr', ['built/pxt.js'], { async: true }, function () {
    cmdIn(this, "test-errors", 'node ../built/pxt.js testdir')
})

task('testlang', ['built/pxt.js'], { async: true }, function () {
    cmdIn(this, "libs/lang-test0", 'node ../../built/pxt.js run')
})

task('testdecompiler', ['built/pxt.js'], { async: true }, function () {
    cmdIn(this, "tests/decompile-test", 'node ../../built/pxt.js testdecompiler .')
})

task('testdecompilererrors', ['built/pxt.js'], { async: true }, function () {
    cmdIn(this, "tests/decompile-test/errors", 'node ../../../built/pxt.js testdecompilererrors .')
})

ju.catFiles('built/pxt.js', [
    "node_modules/typescript/lib/typescript.js",
    "built/pxtlib.js",
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

file('built/blockly.d.ts', ['localtypings/blockly.d.ts'], function () { ju.cpR('localtypings/blockly.d.ts', 'built/blockly.d.ts') })
file('built/monaco.d.ts', ['localtypings/monaco.d.ts'], function () { ju.cpR('localtypings/monaco.d.ts', 'built/monaco.d.ts') })
file('built/pxtparts.d.ts', ['localtypings/pxtparts.d.ts'], function () { ju.cpR('localtypings/pxtparts.d.ts', 'built/pxtparts.d.ts') })
file('built/pxtarget.d.ts', ['built/blockly.d.ts', 'built/pxtpackage.d.ts', 'built/pxtparts.d.ts', 'localtypings/pxtarget.d.ts'], function () { ju.cpR('localtypings/pxtarget.d.ts', 'built/pxtarget.d.ts') })
file('built/pxtpackage.d.ts', ['localtypings/pxtpackage.d.ts'], function () { ju.cpR('localtypings/pxtpackage.d.ts', 'built/pxtpackage.d.ts') })

compileDir("pxtlib", ["built/pxtarget.d.ts", "built/pxtparts.d.ts", "built/pxtpackage.d.ts", "built/typescriptServices.d.ts"])
compileDir("pxtwinrt", ["built/pxtlib.js"])
compileDir("pxtblocks", ["built/pxtlib.js", "built/blockly.d.ts"])
compileDir("pxtrunner", ["built/pxtlib.js", "built/pxtsim.js", "built/pxtblocks.js"])
compileDir("pxtsim", ["built/pxtlib.js", "built/pxtblocks.js"])
compileDir("pxteditor", ["built/pxtlib.js", "built/pxtblocks.js", "built/monaco.d.ts"])
compileDir("cli", ["built/pxtlib.js", "built/pxtsim.js"])
compileDir("backendutils", ["built/pxtarget.d.ts", 'pxtlib/emitter/util.ts', 'pxtlib/docsrender.ts'])

task("travis", ["lint", "test", "upload"])

task('upload', ["wapp", "built/pxt.js"], { async: true }, function () {
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
        "pxt-cli",
        "pxtblocks",
        "pxteditor",
        "pxtlib",
        "pxtlib/emitter",
        "pxtrunner",
        "pxtsim",
        "pxtwinrt",
        "webapp/src",
        "monacots"]
        .map(function (d) { return "node node_modules/tslint/bin/tslint ./" + d + "/*.ts" })
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
        "npm install",
        "tsd reinstall"
    ], { printStdout: true });
})

task('updatestrings', ['built/localization.json'])


file('built/localization.json', ju.expand1(
    ["pxtlib",
        "pxtblocks",
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
    "built/web/pxtsim.js",
    "built/web/pxtblocks.js",
    "built/web/pxteditor.js",
    "built/web/pxtwinrt.js",
    'built/web/main.js',
    'built/web/worker.js',
    'built/web/fonts/icons.woff2',
    'built/web/icons.css',
    'built/web/semantic.css',
    "built/web/semantic.js"
])

file("built/web/pxtlib.js", [
    "built/pxtlib.js",
    "built/pxtblocks.js",
    "built/pxtsim.js",
    "built/pxtrunner.js",
    "built/pxteditor.js",
    "built/pxtwinrt.js"
], function () {
    jake.mkdirP("built/web")
    jake.cpR("node_modules/jquery/dist/jquery.js", "built/web/jquery.js")
    jake.cpR("node_modules/bluebird/js/browser/bluebird.min.js", "built/web/bluebird.min.js")

    jake.cpR("built/pxtlib.js", "built/web/")
    jake.cpR("built/pxtblocks.js", "built/web/")
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
        f => f + " " + additionalExports.map(s => s + ": " + s + ",").join(" "))
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
    cmdIn(this, '../pxt-microbit', 'node ../pxt/built/pxt.js serve ' + cmdArg)
})

file('built/web/vs/editor/editor.main.js', ['node_modules/pxt-monaco-typescript/release/src/monaco.contribution.js'], function () {
    console.log(`Updating the monaco editor bits`)
    jake.mkdirP("built/web/vs/editor")
    let monacotypescriptcontribution = fs.readFileSync("node_modules/pxt-monaco-typescript/release/src/monaco.contribution.js", "utf8")
    monacotypescriptcontribution.replace('["require","exports"]', '["require","exports","vs/editor/edcore.main"]')

    let monacoeditor = fs.readFileSync("node_modules/monaco-editor/dev/vs/editor/editor.main.js", "utf8")
    // Remove certain actions from the context menu
    monacoeditor = monacoeditor.replace(/((GoToDefinitionAction.ID|'editor.action.(changeAll|quickOutline|previewDeclaration|referenceSearch.trigger)')[.\s\S]*?)(menuOpts:[.\s\S]*?})/gi, '$1')
    monacoeditor = monacoeditor.replace(/.*define\(\"vs\/language\/typescript\/src\/monaco.contribution\",.*/gi, `${monacotypescriptcontribution}`)
    fs.writeFileSync("built/web/vs/editor/editor.main.js", monacoeditor)

    jake.mkdirP("webapp/public/vs")
    jake.cpR("node_modules/monaco-editor/min/vs/base", "webapp/public/vs/")
    jake.cpR("node_modules/monaco-editor/min/vs/editor", "webapp/public/vs/")
    fs.unlinkSync("webapp/public/vs/editor/editor.main.js")

    jake.cpR("node_modules/monaco-editor/min/vs/loader.js", "webapp/public/vs/")
    jake.mkdirP("webapp/public/vs/basic-languages/src")
    jake.cpR("node_modules/monaco-editor/min/vs/basic-languages/src/bat.js", "webapp/public/vs/basic-languages/src/")
    jake.cpR("node_modules/monaco-editor/min/vs/basic-languages/src/cpp.js", "webapp/public/vs/basic-languages/src/")
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
    "built/web/pxtblocks.js",
    "built/web/pxteditor.js",
    "built/web/pxtwinrt.js"    
]), { async: true }, function () {
    tscIn(this, "webapp", "built/webapp")
})

file('built/web/main.js', ["built/webapp/src/app.js"], { async: true }, function () {
    cmdIn(this, ".", 'node node_modules/browserify/bin/cmd built/webapp/src/app.js -o built/web/main.js')
})

file('built/web/worker.js', ["built/webapp/src/app.js"], function () {
    jake.cpR("built/webapp/src/worker.js", "built/web/")
})


file('built/web/fonts/icons.woff2', [], function () {
    jake.cpR("node_modules/semantic-ui-less/themes/default/assets/fonts", "built/web/")
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
        "node_modules/semantic-ui-less/definitions/modules",
        "node_modules/semantic-ui-less/definitions/behaviors"], ".js"),
    "")
