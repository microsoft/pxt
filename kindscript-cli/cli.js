"use strict";

let fs = require("fs")
let path = require("path")
let child_process = require("child_process")

let targetdir = ""

function findKindJs() {
    let goUp = (s) => {
        let mod = s + "/node_modules/"
        let installed = mod + "kindscript/built/kind.js"
        let kindcli = mod + "kindcli.json"
        if (fs.existsSync(kindcli)) {
            try {
                let cfg = JSON.parse(fs.readFileSync(kindcli, "utf8"))
                let innerPath = mod + cfg.targetdir + "/"
                targetdir = path.resolve(innerPath)
                let nested = innerPath + "node_modules/kindscript/built/kind.js"
                if (fs.existsSync(nested)) return nested
                if (fs.existsSync(installed)) return installed
                console.error("Found", kindcli, "but cannot find neither", nested, "nor", installed)
                return null
            } catch (e) {
                console.error(kindcli, e.message)
                return null
            }
        }

        let targetjson = s + "/kindtarget.json"
        if (fs.existsSync(targetjson)) {
            targetdir = s            
            let local = s + "/built/kind.js" // local build
            if (fs.existsSync(local)) return local            
            if (fs.existsSync(installed)) return installed            
            console.error("Found", targetjson, "but cannot find neither", local, "nor", installed)
            return null
        }
        
        let s2 = path.resolve(path.join(s, ".."))
        if (s != s2)
            return goUp(s2)

        console.error("Cannot find node_modules/kindcli.json nor kindtarget.json")            
        return null
    }
    
    return goUp(process.cwd())
}

function target(n) {
    if (!fs.existsSync("node_modules"))
        fs.mkdirSync("node_modules")
    console.log(`Installing kindscript-${n} locally; don't worry about package.json warnings.`)
    child_process.execSync(`npm install kindscript-${n}`, {
        stdio: "inherit"
    })
    fs.writeFileSync("node_modules/kindcli.json", JSON.stringify({
        targetdir: "kindscript-" + n
    }, null, 4))
    console.log(`Installed KindScript/${n}. To start server run:`)
    console.log(`    kind serve`)
}

function main() {
    let path = findKindJs();

    let args = process.argv.slice(2)

    if (args[0] == "target") {
        target(args[1])
        process.exit(0)
    }

    if (!path) {
        console.error("Couldn't find KindScript; maybe try 'kind target microbit'?")
        process.exit(1)
    }

    require(path).mainCli(targetdir);
}

main();
