/// <reference path="../typings/globals/node/index.d.ts"/>

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
    let dirs = [
        process.env["HOME"] + "/Library/Arduino",
        process.env["USERPROFILE"] + "/AppData/Local/Arduino",
        process.env["HOME"] + "/.arduino",
    ]

    let pkgDir = ""

    for (let ardV = 15; ardV < 50; ++ardV) {
        for (let d of dirs) {
            pkgDir = d + ardV + "/packages/arduino/"
            if (fs.existsSync(pkgDir)) break
            pkgDir = ""
        }
        if (pkgDir) break
    }

    if (!pkgDir) fatal("cannot find Arduino packages directory")

    let openocdParPath = pkgDir + "tools/openocd/"
    if (!fs.existsSync(openocdParPath)) fatal(openocdParPath + " doesn't exists; openocd not installed in Arduino?")

    let subdirs = fs.readdirSync(openocdParPath)
    if (!subdirs.length)
        fatal("no directories in " + openocdParPath)
    subdirs.sort(pxt.semver.strcmp)
    subdirs.reverse()

    let openocdPath = openocdParPath + subdirs[0] + "/"
    if (!fs.existsSync(openocdPath + "bin")) fatal("openocd not installed in Arduino")

    let openocdBin = openocdPath + "bin/openocd"

    if (process.platform == "win32")
        openocdBin += ".exe"

    let script = pxt.appTarget.compile.openocdScript
    if (!script) fatal("no openocdScript in pxtarget.json")

    let cmd = `log_output built/openocd.log; ${script}; init; halt;`

    let args = [openocdBin, "-d2",
        "-s", openocdPath + "/share/openocd/scripts/",
        "-c", cmd]

    return args
}

export function startAsync(c: commandParser.ParsedCommand) {
    let binTrg = pxt.appTarget.compileService.yottaBinary.replace(/\.hex$/, "").replace(/-combined$/, "")
    let f = "built/yt/build/" + pxt.appTarget.compileService.yottaTarget
        + "/source/" + binTrg;

    if (!fs.existsSync(f))
        fatal("compiled file not found: " + f)

    let oargs = getOpenOcdPath()

    fs.writeFileSync("built/openocd.gdb",
        `target extended-remote localhost:3333\n`)

    pxt.log("starting openocd: " + oargs.join(" "))

    let oproc = child_process.spawn(oargs[0], oargs.slice(1), {
        stdio: "inherit",
        detached: true,
    })

    let gdbargs = ["--command=built/openocd.gdb", f].concat(c.arguments)

    pxt.log("starting gdb with: " + gdbargs.join(" "))

    let proc = child_process.spawn("arm-none-eabi-gdb", gdbargs, {
        stdio: "inherit",
        detached: true,
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
