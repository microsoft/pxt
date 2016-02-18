"use strict";

var fs = require("fs");
var ju = require("../jakeutil")
var expand = ju.expand;
var cmdIn = ju.cmdIn;


task('default', ['built/main.js', 'built/worker.js', 'built/themes', 'built/style.css', "built/semantic.js", 'built/yelmembed.js'])

task('precopy', function () {
    jake.mkdirP("built")
    jake.cpR("node_modules/jquery/dist/jquery.js", "built/jquery.js")
    jake.cpR("ace/mode/assembly_armthumb.js", "node_modules/brace/mode/")
})

task('upper', ["precopy"], { async: true }, function () {
    cmdIn(this, "..", 'jake')
})

task('postcopy', ["upper"], function () {
    jake.cpR("../built/yelmlib.js", "built/yelmlib.js")

    let additionalExports = [
      "getCompletionData"
    ]

    let ts = fs.readFileSync("../node_modules/typescript/lib/typescript.js", "utf8")
    ts = ts.replace(/getCompletionsAtPosition: getCompletionsAtPosition,/, 
        f => f + " " + additionalExports.map(s => s + ": " + s + ",").join(" "))
    fs.writeFileSync("built/typescript.js", ts)
})

task('lower', ["postcopy"], { async: true }, function () {
    cmdIn(this, ".", 'node node_modules/typescript/lib/tsc')
})

file('built/main.js', ["lower"], { async: true }, function () {
    cmdIn(this, ".", 'node node_modules/browserify/bin/cmd built/src/app.js -o built/main.js')
})

file('built/worker.js', ["lower"], function () {
    jake.cpR("built/src/worker.js", "built/")
})

ju.catFiles('built/yelmembed.js', [
    "../libs/mbit/built/yelmembed.js", 
    ])


file('built/themes', [], function () {
    jake.cpR("node_modules/semantic-ui-less/themes", "built/")
})

file('built/style.css', ["theme.config"], { async: true }, function () {
    cmdIn(this, ".", 'node node_modules/less/bin/lessc style.less built/style.css --include-path=node_modules/semantic-ui-less')
})

ju.catFiles("built/semantic.js",
    expand(["node_modules/semantic-ui-less/definitions/globals",
        "node_modules/semantic-ui-less/definitions/modules",
        "node_modules/semantic-ui-less/definitions/behaviors"], ".js"),
    "")


task('clean', function () {
    jake.rmRf("built")
    if (fs.existsSync("built"))
        expand("built").forEach(f => {
            try {
                fs.unlinkSync(f)
            } catch (e) {
                console.log("cannot unlink:", f, e.message)
            }
        })
})
