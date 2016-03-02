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
  file('built/' + name + '.js', dd, {async : true}, function () { tscIn(this, name) })
}

function loadText(filename)
{
    return fs.readFileSync(filename, "utf8");
}

task('default', ['updatestrings', 'runprj', 'embed', 'testfmt', 'sim'])

task('clean', function() {
  // jake.rmRf("built") - doesn't work?
  expand(["built", "libs/lang-test0/built"]).forEach(f => {
      try {
        fs.unlinkSync(f)
      } catch (e) {
          console.log("cannot unlink:", f, e.message)
      }
  })
})

task('runprj', ['built/yelm.js', 'built/yelm.d.ts'], {async:true, parallelLimit: 10}, function() {
  cmdIn(this, "libs/lang-test0", 'node --stack_trace_limit=30 ../../built/yelm.js run')
})

task('testfmt', ['built/yelm.js'], {async:true}, function() {
  cmdIn(this, "libs/format-test", 'node ../../built/yelm.js format -t')
})

task('embed', ['built/yelm.js'], {async:true, parallelLimit: 10}, function() {
  cmdIn(this, "libs/microbit", 'node ../../built/yelm.js genembed')
  cmdIn(this, "libs/microbit-music", 'node ../../built/yelm.js genembed')
  cmdIn(this, "libs/microbit-radio", 'node ../../built/yelm.js genembed')
  cmdIn(this, "libs/microbit-serial", 'node ../../built/yelm.js genembed')
  cmdIn(this, "libs/microbit-led", 'node ../../built/yelm.js genembed')
  cmdIn(this, "libs/microbit-game", 'node ../../built/yelm.js genembed')
  cmdIn(this, "libs/microbit-pins", 'node ../../built/yelm.js genembed')
  cmdIn(this, "libs/microbit-devices", 'node ../../built/yelm.js genembed')
  cmdIn(this, "libs/minecraft", 'node ../../built/yelm.js genembed')
})

ju.catFiles('built/yelm.js', [
    "node_modules/typescript/lib/typescript.js", 
    "built/yelmlib.js",
    "built/nodeutil.js",
    "built/cli.js"
    ],
`
"use strict";
// make sure TypeScript doesn't overwrite our module.exports
global.savedModuleExports = module.exports;
module.exports = null;
`)

file('built/nodeutil.js', ['built/cli.js'])
file('built/yelm.d.ts', ['built/cli.js'], function() {
  jake.cpR("built/cli.d.ts", "built/yelm.d.ts")
})

compileDir("yelmlib")
compileDir("yelmsim", ["built/yelmlib.js"])
compileDir("cli", ["built/yelmlib.js"])

ju.catFiles('built/sim.js', [
    "built/yelmlib.js",
    "built/yelmsim.js"
    ],`
"use strict";
// make sure TypeScript doesn't overwrite our module.exports
global.savedModuleExports = module.exports;
module.exports = null;
`);
task('sim', ['built/sim.js'], function() {})

task('publish', function() {
  jake.exec([
        "npm version patch",
        "npm publish",
  ], {printStdout: true});
})

task('update', function() {
  jake.exec([
        "git pull",
        "npm install",
        "tsd reinstall"
  ], {printStdout: true});
})

task('updatestrings', function() {
    var errCnt = 0;
    var translationStrings = {}
    var translationHelpStrings = {}

    function processLf(filename)
    {
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
    var srcPaths = [
        "libs/microbit", 
        "libs/microbit-devices", 
        "libs/microbit-pins",
        "libs/microbit-led", 
        "libs/microbit-game", 
        "libs/microbit-radio", 
        "libs/microbit-serial", 
        "libs/microbit-music", 
        "libs/minecraft", 
        "webapp/src"]
    srcPaths.forEach(pth => {
        fs.readdirSync(pth).forEach((fn) => {
            fileCnt++;
            processLf(path.join(pth, fn));
        })
    });

    Object.keys(translationHelpStrings).forEach(k => translationStrings[k] = k)
    var tr = Object.keys(translationStrings)
    tr.sort()

    console.log('strings: ' + tr.length);
    if (!fs.existsSync("built")) fs.mkdirSync("built");
    fs.writeFileSync("built/localization.json", JSON.stringify({ strings: tr }, null, 1))
    var strings = {};
    tr.forEach(function(k) { strings[k] = k; });
    fs.writeFileSync("built/strings.json", JSON.stringify(strings, null, 2));

    console.log("*** Stop; " + fileCnt + " files");
    if (errCnt > 0)
        console.log("%d errors", errCnt);
})
