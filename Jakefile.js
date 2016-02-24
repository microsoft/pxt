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

task('default', ['updatestrings', 'runprj', 'embed'])

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

task('runprj', ['built/yelm.js'], {async:true, parallelLimit: 10}, function() {
  cmdIn(this, "libs/lang-test0", 'node --stack_trace_limit=30 ../../built/yelm.js run')
})

task('embed', ['built/yelm.js'], {async:true, parallelLimit: 10}, function() {
  cmdIn(this, "libs/core", 'node ../../built/yelm.js genembed')
  cmdIn(this, "libs/music", 'node ../../built/yelm.js genembed')
  cmdIn(this, "libs/radio", 'node ../../built/yelm.js genembed')
  cmdIn(this, "libs/led", 'node ../../built/yelm.js genembed')
  cmdIn(this, "libs/game", 'node ../../built/yelm.js genembed')
  cmdIn(this, "libs/pins", 'node ../../built/yelm.js genembed')
  cmdIn(this, "libs/devices", 'node ../../built/yelm.js genembed')
})

ju.catFiles('built/yelm.js', [
    "node_modules/typescript/lib/typescript.js", 
    "built/yelmlib.js",
    "built/nodeutil.js",
    "built/cli.js"
    ])

file('built/nodeutil.js', ['built/cli.js'])

compileDir("yelmlib")
compileDir("cli", ["built/yelmlib.js"])

task('publish', function() {
   let pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
   let m = /(.*)\.(\d+)$/.exec(pkg.version)
   pkg.version = m[1] + "." + (parseInt(m[2]) + 1)
   fs.writeFileSync("package.json", JSON.stringify(pkg, null, 4) + "\n")
  jake.exec([
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

        console.log('extracting strings from %s', filename);    
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
        "libs/core", 
        "libs/devices", 
        "libs/pins",
        "libs/led", 
        "libs/game", 
        "libs/radio", 
        "libs/music", 
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
    fs.writeFileSync("built/localization.json", JSON.stringify({ strings: tr }, null, 1))
    var strings = {};
    tr.forEach(function(k) { strings[k] = k; });
    fs.writeFileSync("built/strings.json", JSON.stringify(strings, null, 2));

    console.log("*** Stop; " + fileCnt + " files");
    if (errCnt > 0)
        console.log("%d errors", errCnt);
})