import * as path from 'path';
import * as nodeutil from './nodeutil';
import * as child_process from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import * as net from 'net';
import * as util from 'util';
import * as commandParser from './commandparser';

import U = pxt.Util;

function fatal(msg: string) {
    U.userError(msg)
}

function getOpenOcdPath() {
    function latest(tool: string) {
        let dir = pkgDir + "tools/" + tool + "/"
        if (!fs.existsSync(dir)) fatal(dir + " doesn't exists; " + tool + " not installed in Arduino?")

        let subdirs = fs.readdirSync(dir)
        if (!subdirs.length)
            fatal("no sub-directories in " + dir)
        subdirs.sort(pxt.semver.strcmp)
        subdirs.reverse()

        let thePath = dir + subdirs[0] + "/"
        if (!fs.existsSync(thePath + "bin")) fatal("missing bindir in " + thePath)

        return thePath
    }

    let dirs = [
        process.env["HOME"] + "/Library/Arduino",
        process.env["USERPROFILE"] + "/AppData/Local/Arduino",
        process.env["HOME"] + "/.arduino",
    ]

    let pkgDir = ""
    let openocdPath = ""
    let openocdBin = ""
    let gccPath = ""
    let gdbBin = ""

    if(fs.existsSync("/usr/bin/openocd")){
        openocdPath = "/usr/"
        gccPath = "/usr/"
    }
    else {
        for (let ardV = 15; ardV < 50; ++ardV) {
            for (let d of dirs) {
                pkgDir = d + ardV + "/packages/arduino/"
                if (fs.existsSync(pkgDir)) 
                    break
                pkgDir = ""
            }

            if (pkgDir) 
                break
        }

        if (!pkgDir) 
            fatal("cannot find Arduino packages directory")

        openocdPath = latest("openocd")
        gccPath = latest("arm-none-eabi-gcc")
    }
    
    openocdBin = openocdPath + "bin/openocd"

    if (process.platform == "win32")
        openocdBin += ".exe"

    let script = pxt.appTarget.compile.openocdScript
    if (!script) fatal("no openocdScript in pxtarget.json")

    let cmd = `log_output built/openocd.log; ${script}; init; halt;`

    let args = [openocdBin, "-d2",
        "-s", openocdPath + "share/openocd/scripts/",
        "-c", cmd]

    
    gdbBin = gccPath + "bin/arm-none-eabi-gdb"

    if (process.platform == "win32")
        gdbBin += ".exe"

    return { args, gdbBin }
}

export function startAsync(gdbArgs: string[]) {
    let cs = pxt.appTarget.compileService

    let f =
        cs.codalBinary ?
            "built/codal/build/" + cs.codalBinary :
            "built/yt/build/" + cs.yottaTarget + "/source/" + cs.yottaBinary.replace(/\.hex$/, "").replace(/-combined$/, "");

    if (!fs.existsSync(f))
        fatal("compiled file not found: " + f)

    let toolPaths = getOpenOcdPath()
    let oargs = toolPaths.args

    fs.writeFileSync("built/openocd.gdb",
        `
target extended-remote localhost:3333
define rst
  set {int}(0x20008000-4) = 0xf02669ef
  monitor reset halt
  continue
end
define irq
  echo "Current IRQ: "
  p (*(int*)0xE000ED04 & 0x1f) - 16
end
echo Use 'rst' command to re-run program from start (set your breakpoints first!).\\n
`)

    pxt.log("starting openocd: " + oargs.join(" "))

    let oproc = child_process.spawn(oargs[0], oargs.slice(1), {
        stdio: "inherit",
        detached: true,
    })

    let gdbargs = ["--command=built/openocd.gdb", f].concat(gdbArgs)

    pxt.log("starting gdb with: " + toolPaths.gdbBin + " " + gdbargs.join(" "))

    let proc = child_process.spawn(toolPaths.gdbBin, gdbargs, {
        stdio: "inherit",
        //detached: true,
    })

    process.on('SIGINT', function () {
        // this doesn't actully kill it, it usually just stops the target program
        proc.kill('SIGINT')
    });

    let shutdownOpenocdAsync = () => new Promise((resolve, reject) => {
        let s = net.connect(4444)
        s.on("connect", () => {
            pxt.log("shutdown openocd...")
            s.write("shutdown\n")
            s.end();
        })
        s.on("error", () => {
            pxt.log("Cannot connect to openocd to shut it down. Probably already down.")
            resolve()
        })
        s.on("close", () => resolve())
    })

    let start = Date.now()

    return new Promise<void>((resolve, reject) => {
        proc.on("error", (err: any) => { reject(err) })
        proc.on("close", () => {
            resolve()
        })
    })
        // wait at least two seconds since starting openocd, before trying to close it
        .finally(() => Promise.delay(Math.max(0, 2000 - (Date.now() - start)))
            .then(shutdownOpenocdAsync))
}
