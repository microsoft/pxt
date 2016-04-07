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

task('default', ['updatestrings', 'built/pxt.js', 'built/pxt.d.ts', 'built/pxtrunner.js', 'built/backendutils.js', 'wapp'], { parallelLimit: 10 })

task('test', ['default', 'testfmt'])

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

file('built/pxt-common.json', expand(['libs/pxt-common'], ".ts"), function() {
   console.log(`[${this.name}]`)
   let std = {}
   for (let f of this.prereqs) {
     std[path.basename(f)] = fs.readFileSync(f, "utf8")
   }
   fs.writeFileSync(this.name, JSON.stringify(std, null, 4))
})

compileDir("pxtlib", ["built/typescriptServices.d.ts"])
compileDir("pxtblocks", ["built/pxtlib.js"])
compileDir("pxtrunner", ["built/pxtlib.js", "built/pxtsim.js", "built/pxtblocks.js"])
compileDir("pxtsim", ["built/pxtlib.js", "built/pxtblocks.js"])
compileDir("cli", ["built/pxtlib.js", "built/pxtsim.js"])
compileDir("backendutils", ['pxtlib/emitter/util.ts', 'pxtlib/docsrender.ts'])

task("travis", ["test", "upload"])

task('upload', ["wapp", "built/pxt.js"], { async: true }, function () {
    jake.exec([
          "node built/pxt.js travis",
    ], { printStdout: true });
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
    "built/web/pxtlib.js",
    'built/web/main.js',
    'built/web/worker.js',
    'built/web/fonts/icons.woff2',
    'built/web/icons.css',
    'built/web/semantic.css',
    "built/web/semantic.js"
])

file("built/web/pxtlib.js", ["webapp/ace/mode/assembly_armthumb.js", "built/pxtlib.js", "built/pxtblocks.js", "built/pxtsim.js", "built/pxtrunner.js"], function () {
    jake.mkdirP("built/web")
    jake.cpR("node_modules/jquery/dist/jquery.js", "built/web/jquery.js")
    jake.cpR("node_modules/bluebird/js/browser/bluebird.min.js", "built/web/bluebird.min.js")
    jake.cpR("webapp/ace/mode/assembly_armthumb.js", "node_modules/brace/mode/")
    jake.cpR("built/pxtlib.js", "built/web/")
    jake.cpR("built/pxtblocks.js", "built/web/")
    jake.cpR("built/pxtsim.js", "built/web/")
    jake.cpR("built/pxtrunner.js", "built/web/")

    let additionalExports = [
        "getCompletionData"
    ]

    let ts = fs.readFileSync("node_modules/typescript/lib/typescript.js", "utf8")
    ts = ts.replace(/getCompletionsAtPosition: getCompletionsAtPosition,/,
        f => f + " " + additionalExports.map(s => s + ": " + s + ",").join(" "))
    fs.writeFileSync("built/web/typescript.js", ts)
})

file('built/webapp/src/app.js', expand([
    "webapp", "built/web/pxtlib.js"]), { async: true }, function () {
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

