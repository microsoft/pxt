"use strict";

let fs = require("fs")
let path = require("path")
let child_process = require("child_process")

function findKindJs() {
    let goUp = (s) => {
        let f = s + "/node_modules/kindscript/built/kind.js"
        if (fs.existsSync(f)) return f
        f = s + "/built/kind.js" // local build
        if (fs.existsSync(f)) return f
        let s2 = path.resolve(path.join(s, ".."))
        if (s != s2)
            return goUp(s2)
        return null
    }
    return goUp(process.cwd())
}

function selfInstall() {
    if (!fs.existsSync("node_modules"))
        fs.mkdirSync("node_modules")
    console.log("Installing KindScript locally; don't worry about package.json warnings.")
    child_process.execSync("npm install kindscript", {
        stdio: "inherit"
    })
    console.log("Installed KindScript.")
}

function main() {
    let path = findKindJs();

    let args = process.argv.slice(2)
    if (args[0] == "selfinstall") {
        selfInstall();
        process.exit(0)
    }

    if (!path && /^(install|init)$/.test(args[0])) {
        selfInstall()
        path = findKindJs()
    }
    
    if (!path) {
        console.error("cannot find built/kind.js; maybe try 'kind selfinstall'")
        process.exit(1)
    }

    require(path).mainCli();
}

main();
