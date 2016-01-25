"use strict";

var child_process = require("child_process");
var fs = require("fs");

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
    dir.forEach(f => expand(dir).forEach(f => r.push(f)))
    return r
  }
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory())
    return fs.readdirSync(dir).map(f => dir + "/" + f)
  else return [dir]
}

function catFiles(files, out) {
  fs.writeFileSync(out, files.map(f => fs.readFileSync(f, "utf8")).join(""))
}

function cmdIn(task, dir, cmd) {
  console.log(`[${dir}] ${cmd}`)
  child_process.exec(cmd, { cwd: dir }, execCallback(task))
}

function tscIn(task, dir) {
  cmdIn(task, dir, 'node ../node_modules/typescript/bin/tsc')
}

task('default', ['runprj'])

task('clean', function() {
  jake.rmRf("built")
})

task('runprj', ['built/microbit.js', 'built/sim.js'], {async:true, parallelLimit: 10}, function() {
  cmdIn(this, "mbitprj", 'node ../built/sim.js')
})

file('built/microbit.js', ['built/tsm.js'], {async:true}, function() {
  let f = fs.readdirSync("mbitprj").filter(f => /\.ts$/.test(f)).join(" ")
  cmdIn(this, "mbitprj", 'node ../built/tsm.js ' + f)
})

file('built/tsm.js', ['built/tsmbit.js'], function () {
  catFiles([ "node_modules/typescript/lib/typescript.js",
             "built/tsmbit.js"], "built/tsm.js")
})

file('built/tsmbit.js', expand("src"), {async : true}, function () { tscIn(this, "src") })
file('built/sim.js', expand("mbitsim"), {async: true}, function () { tscIn(this, "mbitsim") })

