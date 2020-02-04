"use strict";

var child_process = require("child_process");
var fs = require("fs");
var path = require("path");
const _rimraf = require("rimraf")


function expand1(dirs) {
    if (!Array.isArray(dirs))
        dirs = [dirs]
    let r = []
    dirs.forEach(dir =>
        fs.readdirSync(dir).forEach(f => r.push(dir + "/" + f)))
    return r
}

function expand(dir, ext) {
    function expandCore(dir) {
        if (Array.isArray(dir)) {
            let r = []
            dir.forEach(f => expandCore(f).forEach(x => r.push(x)))
            return r
        }
        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory())
            return expandCore(fs.readdirSync(dir).map(f => dir + "/" + f))
        else {
            if (ext && dir.slice(-ext.length) != ext)
                return []
            return [dir]
        }
    }

    var res = expandCore(dir)
    //console.log("expand:", dir, res)
    return res
}

function stripSrcMapSync(dir) {
    for (let file of fs.readdirSync(dir)) {
        file = path.resolve(dir, file) + '';
        let isDirectory = fs.statSync(file).isDirectory();
        if (isDirectory) {
            stripSrcMapSync(file);
        } else {
            let fileContents = fs.readFileSync(file, "utf8");
            fileContents = fileContents.replace(/(?:[^"]|^)\/\/# sourceMappingURL=.*/gi, '')
            fs.writeFileSync(file, fileContents)
        }
    }
}

function rimraf(dirname) {
    return new Promise((resolve, reject) => {
        _rimraf(dirname, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function exec(command, log) {
    return new Promise((resolve, reject) => {
        const ps = child_process.exec(command, { encoding: "utf8"}, (err, stdout) => {
            if (err) reject(err);
            else resolve(stdout);
        });

        if (log) {
            process.stdout.setMaxListeners(20);
            process.stderr.setMaxListeners(20);

            ps.stdout.pipe(process.stdout);
            ps.stderr.pipe(process.stderr);
        }
    });
}

exports.expand = expand;
exports.expand1 = expand1;
exports.stripSrcMapSync = stripSrcMapSync;
exports.exec = exec;
exports.rimraf = rimraf;