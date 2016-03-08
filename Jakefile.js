"use strict";

var fs = require("fs");
var ju = require("./jakeutil")
var path = require("path")
var expand = ju.expand;
var cmdIn = ju.cmdIn;

function tscIn(task, dir) {
    cmdIn(task, dir, 'node ../node_modules/typescript/bin/tsc')
}

function compileDir(name, deps) {
    if (!deps) deps = []
    let dd = expand([name].concat(deps))
    file('built/' + name + '.js', dd, { async: true }, function () { tscIn(this, name) })
}

function loadText(filename) {
    return fs.readFileSync(filename, "utf8");
}

task('default', ['updatestrings', 'built/yelm.js', 'built/yelm.d.ts', 'wapp'], { parallelLimit: 10 })

task('test', ['default', 'runprj', 'testfmt'])

task('clean', function () {
    expand(["built", "libs/lang-test0/built"]).forEach(f => {
        try {
            fs.unlinkSync(f)
        } catch (e) {
            console.log("cannot unlink:", f, e.message)
        }
    })
    jake.rmRf("built")
})

task('runprj', ['built/yelm.js'], { async: true, parallelLimit: 10 }, function () {
    cmdIn(this, "libs/lang-test0", 'node --stack_trace_limit=30 ../../built/yelm.js run')
})

task('testfmt', ['built/yelm.js'], { async: true }, function () {
    cmdIn(this, "libs/format-test", 'node ../../built/yelm.js format -t')
})

let embedFiles = [
    "libs/microbit",
    "libs/microbit-music",
    "libs/microbit-radio",
    "libs/microbit-serial",
    "libs/microbit-led",
    "libs/microbit-game",
    "libs/microbit-pins",
    "libs/microbit-devices",
    "libs/minecraft",
]

embedFiles.forEach(f => {
    file(f + "/built/yelmembed.js", expand([f]).filter(f => !/\/built\//.test(f)), { async: true }, function () {
        cmdIn(this, f, 'node ../../built/yelm.js genembed')
    })
})

ju.catFiles('built/web/yelmembed.js', embedFiles.map(f => f + "/built/yelmembed.js"))


ju.catFiles('built/yelm.js', [
    "node_modules/typescript/lib/typescript.js",
    "built/yelmlib.js",
    "built/yelmsim.js",
    "built/cli.js"
],
    `
"use strict";
// make sure TypeScript doesn't overwrite our module.exports
global.savedModuleExports = module.exports;
module.exports = null;
`)

file('built/nodeutil.js', ['built/cli.js'])
file('built/yelm.d.ts', ['built/cli.js'], function () {
    jake.cpR("built/cli.d.ts", "built/yelm.d.ts")
})

compileDir("yelmlib")
compileDir("yelmsim", ["built/yelmlib.js"])
compileDir("cli", ["built/yelmlib.js", "built/yelmsim.js"])

task("travis", ["test", "upload"])

task('upload', ["wapp", "built/yelm.js"], { async: true }, function () {
    cmdIn(this, ".", 'node built/yelm.js uploadrel latest')
})

task('npmpub', function () {
    jake.exec([
        "npm version patch",
        "npm publish",
    ], { printStdout: true });
})

task('yelmpub', { async: true }, function () {
    let cmds = embedFiles.map(f => {
        return {
            cmd: "node",
            args: ["../../built/yelm.js", "publish"],
            dir: f
        }
    })
    ju.cmdsIn(this, cmds)
})

task('update', function () {
    jake.exec([
        "git pull",
        "npm install",
        "tsd reinstall"
    ], { printStdout: true });
})

task('updatestrings', ['built/localization.json'])



file('built/localization.json', ju.expand1(embedFiles.concat(["webapp/src"])), function () {
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
    "built/web/yelmlib.js",
    'built/web/main.js',
    'built/web/worker.js',
    'built/web/themes/default/assets/fonts/icons.woff2',
    'built/web/style.css',
    "built/web/semantic.js",
    'built/web/yelmembed.js'
])

file("built/web/yelmlib.js", ["webapp/ace/mode/assembly_armthumb.js", "built/yelmlib.js", "built/yelmsim.js"], function () {
    jake.mkdirP("built/web")
    jake.cpR("node_modules/jquery/dist/jquery.js", "built/web/jquery.js")
    jake.cpR("node_modules/bluebird/js/browser/bluebird.min.js", "built/web/bluebird.min.js")
    jake.cpR("webapp/ace/mode/assembly_armthumb.js", "node_modules/brace/mode/")
    jake.cpR("built/yelmlib.js", "built/web/yelmlib.js")
    jake.cpR("built/yelmsim.js", "built/web/yelmsim.js")

    let additionalExports = [
        "getCompletionData"
    ]

    let ts = fs.readFileSync("node_modules/typescript/lib/typescript.js", "utf8")
    ts = ts.replace(/getCompletionsAtPosition: getCompletionsAtPosition,/,
        f => f + " " + additionalExports.map(s => s + ": " + s + ",").join(" "))
    fs.writeFileSync("built/web/typescript.js", ts)
})

file('built/webapp/src/app.js', expand([
    "webapp", "built/web/yelmlib.js"]), { async: true }, function () {
        tscIn(this, "webapp")
    })

file('built/web/main.js', ["built/webapp/src/app.js"], { async: true }, function () {
    cmdIn(this, ".", 'node node_modules/browserify/bin/cmd built/webapp/src/app.js -o built/web/main.js')
})

file('built/web/worker.js', ["built/webapp/src/app.js"], function () {
    jake.cpR("built/webapp/src/worker.js", "built/web/")
})


file('built/web/themes/default/assets/fonts/icons.woff2', [], function () {
    jake.cpR("node_modules/semantic-ui-less/themes", "built/web/")
})

file('built/web/style.css', ["webapp/theme.config"], { async: true }, function () {
    cmdIn(this, ".", 'node node_modules/less/bin/lessc webapp/style.less built/web/style.css --include-path=node_modules/semantic-ui-less:webapp/foo/bar')
})

ju.catFiles("built/web/semantic.js",
    expand(["node_modules/semantic-ui-less/definitions/globals",
        "node_modules/semantic-ui-less/definitions/modules",
        "node_modules/semantic-ui-less/definitions/behaviors"], ".js"),
    "")

