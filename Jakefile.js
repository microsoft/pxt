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
    fs.writeFileSync(out, files.map(f => fs.readFileSync(f, "utf8")).join(""))
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
  jake.rmRf("built")
})

task('runprj', ['built/microbit.js', 'built/mbitsim.js'], {async:true, parallelLimit: 10}, function() {
  cmdIn(this, "mbitprj", 'node ../built/mbitsim.js')
})

file('built/microbit.js', ['built/yelm.js'], {async:true}, function() {
  let f = fs.readdirSync("mbitprj").filter(f => /\.ts$/.test(f)).join(" ")
  cmdIn(this, "mbitprj", 'node ../built/yelm.js ' + f)
})

catFiles('built/yelm.js', [
    "node_modules/typescript/lib/typescript.js", 
    "built/emitter.js",
    "built/yelmlib.js",
    "built/cli.js"
    ])

compileDir("yelmlib", ["built/emitter.js"])
compileDir("cli", ["built/yelmlib.js"])
compileDir("emitter")
compileDir("mbitsim")
