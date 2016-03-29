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

task('default', ['updatestrings', 'built/kind.js', 'built/kind.d.ts', 'built/kindrunner.js', 'built/backendutils.js', 'wapp'], { parallelLimit: 10 })

task('test', ['default', 'runprj', 'testfmt'])

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

task('runprj', ['built/kind.js'], { async: true, parallelLimit: 10 }, function () {
    cmdIn(this, "libs/lang-test0", 'node --stack_trace_limit=30 ../../built/kind.js run')
})

task('testfmt', ['built/kind.js'], { async: true }, function () {
    cmdIn(this, "libs/format-test", 'node ../../built/kind.js format -t')
})

ju.catFiles('built/kind.js', [
    "node_modules/typescript/lib/typescript.js",
    "built/kindlib.js",
    "built/kindsim.js",
    "built/cli.js"
],
    `
"use strict";
// make sure TypeScript doesn't overwrite our module.exports
global.savedModuleExports = module.exports;
module.exports = null;
`)

file('built/nodeutil.js', ['built/cli.js'])
file('built/kind.d.ts', ['built/cli.js'], function () {
    jake.cpR("built/cli.d.ts", "built/kind.d.ts")
})
file('built/typescriptServices.d.ts', ['node_modules/typescript/lib/typescriptServices.d.ts'], function () {
    if (!fs.existsSync("built")) fs.mkdirSync("built");
    jake.cpR('node_modules/typescript/lib/typescriptServices.d.ts', "built/")
})

compileDir("kindlib", ["built/typescriptServices.d.ts"])
compileDir("kindblocks", ["built/kindlib.js"])
compileDir("kindrunner", ["built/kindlib.js", "built/kindsim.js", "built/kindblocks.js"])
compileDir("kindsim", ["built/kindlib.js", "built/kindblocks.js"])
compileDir("cli", ["built/kindlib.js", "built/kindsim.js"])
compileDir("backendutils", ['kindlib/emitter/util.ts', 'kindlib/docsrender.ts'])

task("travis", ["test", "upload"])

task('upload', ["wapp", "built/kind.js"], { async: true }, function () {
    jake.exec([
          "node built/kind.js travis",
    ], { printStdout: true });
})


task('bump', function () {
    jake.exec([
        "node built/kind.js bump",
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



file('built/localization.json', ju.expand1(["webapp/src"]), function () {
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
    "built/web/kindlib.js",
    'built/web/main.js',
    'built/web/worker.js',
    'built/web/fonts/icons.woff2',
    'built/web/hexinfo.js',
    'built/web/icons.css',
    'built/web/semantic.css',
    "built/web/semantic.js"
])

file("built/web/hexinfo.js", ["generated/hexinfo.js"], function() {
    let hi = fs.readFileSync("generated/hexinfo.js", "utf8")
    hi = hi.replace(/module.exports =/, "var ksHexInfo =")
    fs.writeFileSync("built/web/hexinfo.js", hi)
})

file("built/web/kindlib.js", ["webapp/ace/mode/assembly_armthumb.js", "built/kindlib.js", "built/kindblocks.js", "built/kindsim.js", "built/kindrunner.js"], function () {
    jake.mkdirP("built/web")
    jake.cpR("node_modules/jquery/dist/jquery.js", "built/web/jquery.js")
    jake.cpR("node_modules/bluebird/js/browser/bluebird.min.js", "built/web/bluebird.min.js")
    jake.cpR("webapp/ace/mode/assembly_armthumb.js", "node_modules/brace/mode/")
    jake.cpR("built/kindlib.js", "built/web/")
    jake.cpR("built/kindblocks.js", "built/web/")
    jake.cpR("built/kindsim.js", "built/web/")
    jake.cpR("built/kindrunner.js", "built/web/")

    let additionalExports = [
        "getCompletionData"
    ]

    let ts = fs.readFileSync("node_modules/typescript/lib/typescript.js", "utf8")
    ts = ts.replace(/getCompletionsAtPosition: getCompletionsAtPosition,/,
        f => f + " " + additionalExports.map(s => s + ": " + s + ",").join(" "))
    fs.writeFileSync("built/web/typescript.js", ts)
})

file('built/webapp/src/app.js', expand([
    "webapp", "built/web/kindlib.js"]), { async: true }, function () {
        tscIn(this, "webapp")
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

file('built/web/semantic.css', ["webapp/theme.config"], { async: true }, function () {
    cmdIn(this, ".", 'node node_modules/less/bin/lessc webapp/style.less built/web/semantic.css --include-path=node_modules/semantic-ui-less:webapp/foo/bar')
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
  }, function(error, res) {
    if (error) {
      task.fail(error)
    } else {
      let css = res.generateCss()
      let data = res["woff"].toString("base64")
      css = css.replace(/^\s*src:[^;]+;/m, 
        "    src: url(data:application/x-font-woff;charset=utf-8;base64," + data + ") format(\"woff\");")
      css = css.replace(/line-height:\s*1;/, "")
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

