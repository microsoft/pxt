"use strict";

const fs = require("fs")
const path = require("path")
const child_process = require("child_process")

var targetdir = ""

function findPxtJs() {
    var goUp = (s) => {
        var mod = s + "/node_modules/"
        var installed = mod + "pxt-core/built/pxt.js"
        var pxtcli = mod + "pxtcli.json"
        if (fs.existsSync(pxtcli)) {
            try {
                var cfg = JSON.parse(fs.readFileSync(pxtcli, "utf8"))
                var innerPath = mod + cfg.targetdir + "/"
                targetdir = path.resolve(innerPath)
                var nested = innerPath + "node_modules/pxt-core/built/pxt.js"
                if (fs.existsSync(nested)) return nested
                if (fs.existsSync(installed)) return installed
                console.error("Found", pxtcli, "but cannot find neither", nested, "nor", installed)
                return null
            } catch (e) {
                console.error(pxtcli, e.message)
                return null
            }
        }

        var targetjson = s + "/pxtarget.json"
        if (fs.existsSync(targetjson)) {
            targetdir = s
            var local = s + "/built/pxt.js" // local build
            if (fs.existsSync(local)) return local
            if (fs.existsSync(installed)) return installed

            var cfg = JSON.parse(fs.readFileSync(targetjson, "utf8"))
            if (cfg.forkof) {
                installed = mod + "pxt-" + cfg.forkof + "/node_modules/pxt-core/built/pxt.js"
                if (fs.existsSync(installed)) return installed
            }

            console.error("Found", targetjson, "but cannot find neither",
                local, "nor", installed, ", did you run 'npm run build' in the PXT folder once?")
            return null
        }

        var s2 = path.resolve(path.join(s, ".."))
        if (s != s2)
            return goUp(s2)

        console.error("Cannot find node_modules/pxtcli.json nor pxtarget.json")
        return null
    }

    return goUp(process.cwd())
}

function target(n,t) {
    if (!fs.existsSync("node_modules"))
        fs.mkdirSync("node_modules")
    console.log(`Installing pxt-${n} ${t || ""} locally; don't worry about package.json warnings.`)
    child_process.execSync(`npm install pxt-${n} ${t ? `--tag ${t}` : ''}`, {
        stdio: "inherit"
    })
    fs.writeFileSync("node_modules/pxtcli.json", JSON.stringify({
        targetdir: "pxt-" + n
    }, null, 4))
    console.log(`Installed PXT/${n}. To start server run:`)
    console.log(`    pxt serve`)
    console.log(`To build a package, run:`)
    console.log(`    pxt build`)
}

function link(dir) {
    if (!dir) {
        console.log("No directory specified")
        process.exit(1);
    }
    var absPath = path.resolve(dir);

    if (!fs.existsSync(absPath)) {
        console.log("Could not find " + absPath);
        process.exit(1);
    }

    var pkgName = "pxt-core";
    if (fs.existsSync(path.join(absPath, "package.json"))) {
        var pkg = require(path.join(absPath, "package.json"));
        pkgName = pkg.name;
    }

    var modulesPath = path.resolve("node_modules");

    if (!fs.existsSync(modulesPath))
        fs.mkdirSync(modulesPath)

    var corePath = path.join(modulesPath, pkgName);
    if (fs.existsSync(corePath)) {
        var stats = fs.statSync(corePath);
        if (stats.isSymbolicLink()) {
            fs.unlinkSync(corePath);
        }
        else {
            try {
                var rimraf = require("rimraf");
                if (rimraf) {
                    rimraf.sync(corePath)
                }
            }
            catch (e) {
            }
        }
    }

    if (fs.existsSync(corePath)) {
        console.log("Could not remove " + corePath);
        process.exit(1);
    }

    fs.symlinkSync(absPath, corePath, "junction")
    console.log(path.relative(process.cwd(), corePath) + " -> " + absPath);
}

function main() {
    var args = process.argv.slice(2)

    if (args[0] == "target") {
        target(args[1], args[2])
        process.exit(0)
    }
    else if (args[0] == "link") {
        link(args[1]);
        process.exit(0);
    }

    var path = findPxtJs();
    if (!path) {
        console.error("Couldn't find PXT; maybe try 'pxt target microbit'?")
        process.exit(1)
    }

    require(path).mainCli(targetdir);
}

main();
