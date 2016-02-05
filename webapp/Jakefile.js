"use strict";

var fs = require("fs");
var ju = require("../jakeutil")
var expand = ju.expand;
var cmdIn = ju.cmdIn;


task('default', ['built/main.js', 'built/themes', 'built/style.css', "built/semantic.js"])

task('precopy', function() {
    jake.mkdirP("built")
    jake.cpR("node_modules/jquery/dist/jquery.js", "built/jquery.js")
})

task('upper', ["precopy"], function() {
  cmdIn(this, "..", 'jake built/yelmlib.js')  
})

task('postcopy', ["upper"], function() {
    jake.cpR("../built/yelmlib.js", "built/yelmlib.js")
    jake.cpR("../node_modules/typescript/lib/typescript.js", "built/typescript.js")
})

task('lower', ["postcopy"], function() {
    cmdIn(this, ".", 'node node_modules/typescript/lib/tsc')  
})

task('built/main.js', ["lower"], function() {
    cmdIn(this, ".", 'node node_modules/browserify/bin/cmd built/src/app.js -o built/main.js')
})

task('built/themes', [], function() {
    jake.cpR("node_modules/semantic-ui-less/themes", "built/")
})

task('built/style.css', ["theme.config"], function() {
    cmdIn(this, ".", 'node node_modules/less/bin/lessc style.less built/style.css --include-path=node_modules/semantic-ui-less')
})

ju.catFiles("built/semantic.js",
    expand("node_modules/semantic-ui-less/definitions/globals", ".js")
        .concat(expand("node_modules/semantic-ui-less/definitions/modules", ".js"))
        .concat(expand("node_modules/semantic-ui-less/definitions/behaviors", ".js"))
        )

        
task('clean', function() {
  jake.rmRf("built")
  expand("built").forEach(f => {
      try {
        fs.unlinkSync(f)
      } catch (e) {
          console.log("cannot unlink:", f, e.message)
      }
  })
})
