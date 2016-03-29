"use strict";

let fs = require("fs")
let path = require("path")
let child_process = require("child_process")

function findKindJs() {
    let goUp = (s) => {
        let mod = s + "/node_modules/"
        let f = ""
        if (fs.existsSync(mod)) {
            f = mod + "kindscript/built/kind.js"
            if (fs.existsSync(f)) return f
            for (let dir of fs.readdirSync(mod)) {
                let inner = mod + dir + "/node_modules/kindscript/built/kind.js"
                if (fs.existsSync(inner)) return inner
            }
        }
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

function target(n) {
    if (!fs.existsSync("node_modules"))
        fs.mkdirSync("node_modules")
    console.log(`Installing kindscript-${n} locally; don't worry about package.json warnings.`)
    child_process.execSync(`npm install kindscript-${n}`, {
        stdio: "inherit"
    })
    console.log(`Installed KindScript/${n}. To start server run:`)
    console.log(`    kind serve`)
}

function main() {
    let path = findKindJs();

    let args = process.argv.slice(2)
    if (args[0] == "selfinstall") {
        selfInstall();
        process.exit(0)
    }

    if (args[0] == "target") {
        target(args[1])
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
