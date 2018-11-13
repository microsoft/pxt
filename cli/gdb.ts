import * as path from 'path';
import * as nodeutil from './nodeutil';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as buildengine from './buildengine';
import * as commandParser from './commandparser';

import U = pxt.Util;

function fatal(msg: string) {
    U.userError(msg)
}

function getOpenOcdPath(cmds = "") {
    function latest(tool: string) {
        let dir = path.join(pkgDir, "tools/", tool, "/")
        if (!fs.existsSync(dir)) fatal(dir + " doesn't exists; " + tool + " not installed in Arduino?")

        let subdirs = fs.readdirSync(dir)
        if (!subdirs.length)
            fatal("no sub-directories in " + dir)
        subdirs.sort(pxt.semver.strcmp)
        subdirs.reverse()

        let thePath = path.join(dir, subdirs[0], "/")
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

    if (fs.existsSync("/usr/bin/openocd")) {
        openocdPath = "/usr/"
        gccPath = "/usr/"
    }
    else {
        for (let ardV = 15; ardV < 50; ++ardV) {
            for (let d of dirs) {
                pkgDir = path.join(d + ardV, "/packages/arduino/")
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

    openocdBin = path.join(openocdPath, "bin/openocd")

    if (process.platform == "win32")
        openocdBin += ".exe"

    let script = pxt.appTarget.compile.openocdScript
    if (!script) fatal("no openocdScript in pxtarget.json")

    if (!cmds)
        cmds = `
gdb_port pipe
gdb_memory_map disable

$_TARGETNAME configure -event gdb-attach {
    echo "Halting target"
    halt
}

$_TARGETNAME configure -event gdb-detach {
    echo "Resetting target"
    reset
}`

    fs.writeFileSync("built/debug.cfg", `
log_output built/openocd.log
${script}
${cmds}
`)

    let args = [openocdBin, "-d2",
        "-s", path.join(openocdPath, "share/openocd/scripts/"),
        "-f", "built/debug.cfg"]

    gdbBin = path.join(gccPath, "bin/arm-none-eabi-gdb")

    if (process.platform == "win32")
        gdbBin += ".exe"

    return { args, gdbBin }
}

function codalBin() {
    let cs = pxt.appTarget.compileService

    return cs.codalBinary ?
        buildengine.thisBuild.buildPath + "/build/" + cs.codalBinary :
        "built/yt/build/" + cs.yottaTarget + "/source/" + cs.yottaBinary.replace(/\.hex$/, "").replace(/-combined$/, "");
}

export async function dumplogAsync() {
    let m = /0x0000000([0-9a-f]+)\s+codalLogStore\s*$/m.exec(fs.readFileSync(codalBin() + ".map", "utf8"))
    if (!m) fatal("Can't find codalLogStore symbol in map")
    let addr = parseInt(m[1], 16) + 4
    let logSize = 1024
    let toolPaths = getOpenOcdPath(`
init
halt
set M(0) 0
mem2array M 8 ${addr} ${logSize}
resume
parray M
shutdown
`)
    let oargs = toolPaths.args
    let res = await nodeutil.spawnWithPipeAsync({
        cmd: oargs[0],
        args: oargs.slice(1),
        silent: true
    })
    let buf = Buffer.alloc(logSize)
    for (let line of res.toString("utf8").split(/\r?\n/)) {
        let m = /^M\((\d+)\)\s*=\s*(\d+)/.exec(line)
        if (m)
            buf[parseInt(m[1])] = parseInt(m[2])
    }
    for (let i = 0; i < logSize; ++i) {
        if (buf[i] == 0) {
            console.log("\n\n" + buf.slice(0,i).toString("utf8"))
            break
        }
    }
}

export function startAsync(gdbArgs: string[]) {
    let elfFile = codalBin()
    if (!fs.existsSync(elfFile))
        fatal("compiled file not found: " + elfFile)

    let toolPaths = getOpenOcdPath()
    let oargs = toolPaths.args

    let goToApp = ""
    let goToBl = ""

    if (/at91samd/.test(pxt.appTarget.compile.openocdScript)) {
        let ramSize = pxt.appTarget.compile.ramSize || 0x8000
        let addr = 0x20000000 + ramSize - 4
        goToApp = `set {int}(${addr}) = 0xf02669ef`
        goToBl = `set {int}(${addr}) = 0xf01669ef`
    }

    // use / not \ for paths on Windows; otherwise gdb has issue starting openocd
    fs.writeFileSync("built/openocd.gdb",
        `
target remote | ${oargs.map(s => `"${s.replace(/\\/g, "/")}"`).join(" ")}
define rst
  ${goToApp}
  monitor reset halt
  continue
end
define boot
  ${goToBl}
  monitor reset
  quit
end
define irq
  echo "Current IRQ: "
  p (*(int*)0xE000ED04 & 0x1f) - 16
end
define exn
  echo PC:
  p ((void**)$sp)[5]
  echo LR:
  p ((void**)$sp)[6]
end
define log
  set height 0
  set width 0
  printf "%s", codalLogStore.buffer
end
echo \\nUse 'rst' command to re-run program from start (set your breakpoints first!).\\n
echo Use 'boot' to go into bootloader, 'log' to dump DMESG, and 'exn' to display exception info.\\n\\n
`)

    pxt.log("starting openocd: " + oargs.join(" "))

    let gdbargs = ["--command=built/openocd.gdb", elfFile].concat(gdbArgs)

    pxt.log("starting gdb with: " + toolPaths.gdbBin + " " + gdbargs.join(" "))

    let proc = child_process.spawn(toolPaths.gdbBin, gdbargs, {
        stdio: "inherit",
        //detached: true,
    })

    process.on('SIGINT', function () {
        // this doesn't actully kill it, it usually just stops the target program
        proc.kill('SIGINT')
    });

    return new Promise<void>((resolve, reject) => {
        proc.on("error", (err: any) => { reject(err) })
        proc.on("close", () => {
            resolve()
        })
    })
}
