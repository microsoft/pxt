"use strict";

let fs = require("fs")
let path = require("path")
let child_process = require("child_process")

function findYelmJs() {
    let goUp = (s) => {
        let f = s + "/node_modules/yelm/built/yelm.js"
        if (fs.existsSync(f)) return f
        f = s + "/built/yelm.js" // local build
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
    child_process.execSync("npm install yelm", {
        stdio: "inherit"
    })
}

function main() {
    let path = findYelmJs();

    let args = process.argv.slice(2)
    if (args[0] == "selfinstall") {
        selfInstall();
        process.exit(0)
    }

    if (!path && /^(install|init)$/.test(args[0])) {
        selfInstall()
        path = findYelmJs()
    }
    
    if (!path) {
        console.error("cannot find built/yelm.js; maybe try 'yelm selfinstall'")
        process.exit(1)
    }
    
    require(path)
}

main();
