"use strict";

let fs = require("fs")
let path = require("path")
let child_process = require("child_process")

let targetdir = ""

function findPxtJs() {
    let goUp = (s) => {
        let mod = s + "/node_modules/"
        let installed = mod + "pxt-core/built/pxt.js"
        let pxtcli = mod + "pxtcli.json"
        if (fs.existsSync(pxtcli)) {
            try {
                let cfg = JSON.parse(fs.readFileSync(pxtcli, "utf8"))
                let innerPath = mod + cfg.targetdir + "/"
                targetdir = path.resolve(innerPath)
                let nested = innerPath + "node_modules/pxt-core/built/pxt.js"
                if (fs.existsSync(nested)) return nested
                if (fs.existsSync(installed)) return installed
                console.error("Found", pxtcli, "but cannot find neither", nested, "nor", installed)
                return null
            } catch (e) {
                console.error(pxtcli, e.message)
                return null
            }
        }

        let targetjson = s + "/pxtarget.json"
        if (fs.existsSync(targetjson)) {
            targetdir = s            
            let local = s + "/built/pxt.js" // local build
            if (fs.existsSync(local)) return local            
            if (fs.existsSync(installed)) return installed            
            console.error("Found", targetjson, "but cannot find neither", local, "nor", installed, ", did you run 'jake' in the PXT folder once?")
            return null
        }
        
        let s2 = path.resolve(path.join(s, ".."))
        if (s != s2)
            return goUp(s2)

        console.error("Cannot find node_modules/pxtcli.json nor pxtarget.json")            
        return null
    }
    
    return goUp(process.cwd())
}

function target(n) {
    if (!fs.existsSync("node_modules"))
        fs.mkdirSync("node_modules")
    console.log(`Installing pxt-${n} locally; don't worry about package.json warnings.`)
    child_process.execSync(`npm install pxt-${n}`, {
        stdio: "inherit"
    })
    fs.writeFileSync("node_modules/pxtcli.json", JSON.stringify({
        targetdir: "pxt-" + n
    }, null, 4))
    console.log(`Installed PXT/${n}. To start server run:`)
    console.log(`    pxt serve`)
}

function main() {
    let path = findPxtJs();

    let args = process.argv.slice(2)

    if (args[0] == "target") {
        target(args[1])
        process.exit(0)
    }

    if (!path) {
        console.error("Couldn't find PXT; maybe try 'pxt target microbit'?")
        process.exit(1)
    }

    require(path).mainCli(targetdir);
}

main();
