"use strict";

var child_process = require("child_process");
var fs = require("fs");
var util = require("util");

// for use with child_process.exec/execFile
function execCallback(task) {
  return function (error, stdout, stderr) {
    if (stdout) console.log(stdout.toString());
    if (stderr) console.error(stderr.toString());
    if (error) {
      console.error(error);
      task.fail(error);
    }
    else task.complete();
  }
}

function expand(dir) {
  if (Array.isArray(dir)) {
    let r = []
    dir.forEach(f => expand(f).forEach(x => r.push(x)))
    return r
  }
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory())
    return fs.readdirSync(dir).map(f => dir + "/" + f)
  else return [dir]
}

function catFiles(out, files) {
  file(out, files, function () {
      let cont = files.map(f => fs.readFileSync(f, "utf8").replace(/\r/g, ""))
      cont.unshift('"use strict";')
    fs.writeFileSync(out, cont.join("\n"))
  })
}

function cmdIn(task, dir, cmd) {
  console.log(`[${task.name}] cd ${dir}; ${cmd}`)
  child_process.exec(cmd, { cwd: dir }, execCallback(task))
}

function tscIn(task, dir) {
  cmdIn(task, dir, 'node ../node_modules/typescript/bin/tsc')
}

function compileDir(name, deps) {
  if (!deps) deps = []
  let dd = expand([name].concat(deps))
  file('built/' + name + '.js', dd, {async : true}, function () { tscIn(this, name) })
}

task('default', ['runprj'])

task('clean', function() {
  // jake.rmRf("built") - doesn't work?
  expand("built").forEach(f => {
      try {
      fs.unlinkSync(f)
      } catch (e) {
          console.log("cannot unlink:", f, e.message)
      }
  })
})

task('runprj', ['built/mbitsim.js', 'libs/hello/built/microbit.js'], {async:true, parallelLimit: 10}, function() {
  cmdIn(this, ".", 'node ' + this.prereqs.join(" "))
})

file('libs/hello/built/microbit.js', ['built/yelm.js'], {async:true}, function() {
  cmdIn(this, "libs/hello", 'node ../../built/yelm.js build')
})

catFiles('built/yelm.js', [
    "node_modules/typescript/lib/typescript.js", 
    "built/yelmlib.js",
    "built/nodeutil.js",
    "built/cli.js"
    ])

file('built/nodeutil.js', ['built/cli.js'])

compileDir("yelmlib", ["emitter"])
compileDir("cli", ["built/yelmlib.js"])
compileDir("mbitsim")

task('update', {async:true}, function() {
  jake.exec([
        "git pull",
        "npm install",
        "tsd reinstall"
  ], {printStdout: true});
})

