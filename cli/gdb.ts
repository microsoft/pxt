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
        process.env["USERPROFILE"] + "/AppData/Local/Arduino15",
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

function getMap() {
    return fs.readFileSync(codalBin() + ".map", "utf8")
}

function findAddr(symbolName: string) {
    let addr = ""
    getMap().replace(/0x0000000([0-9a-f]+)\s+([:\w]+)\s*(= .*)?$/mg,
        (f, addr0, nm) => {
            if (nm == symbolName)
                addr = addr0
            return ""
        })
    if (addr) {
        return parseInt(addr, 16)
    } else {
        fatal(`Can't find ${symbolName} symbol in map`)
        return -1
    }
}

async function getMemoryAsync(addr: number, bytes: number) {
    let toolPaths = getOpenOcdPath(`
init
halt
set M(0) 0
mem2array M 32 ${addr} ${(bytes + 3) >> 2}
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
    let buf = Buffer.alloc(bytes)
    for (let line of res.toString("utf8").split(/\r?\n/)) {
        let m = /^M\((\d+)\)\s*=\s*(\d+)/.exec(line)
        if (m) {
            pxt.HF2.write32(buf, parseInt(m[1]) << 2, parseInt(m[2]))
        }
    }
    return buf
}

function hex(n: number) {
    return "0x" + n.toString(16)
}

export async function dumpheapAsync() {
    let memStart = findAddr("_sdata")
    let memEnd = findAddr("_estack")
    console.log(`memory: ${hex(memStart)} - ${hex(memEnd)}`)
    let mem = await getMemoryAsync(memStart, memEnd - memStart)
    let heapDesc = findAddr("heap")
    let m = /\.bss\.heap\s+0x000000[a-f0-9]+\s+0x([a-f0-9]+)/.exec(getMap())
    let heapSz = 8
    let heapNum = parseInt(m[1], 16) / heapSz
    console.log(`heaps at ${hex(heapDesc)}, num=${heapNum}`)
    for (let i = 0; i < heapNum; ++i) {
        let heapStart = read32(heapDesc + i * heapSz)
        let heapEnd = read32(heapDesc + i * heapSz + 4)
        console.log(`*** heap ${hex(heapStart)} ${heapEnd - heapStart} bytes`)

        let block = heapStart

        let totalFreeBlock = 0
        let totalUsedBlock = 0
        let prevFree = true
        let prevSize = 0
        let prevCnt = 0
        const flush = () => {
            if (!prevCnt) return
            console.log(`[${prevFree ? "F" : "U"}${prevCnt == 1 ? "" : "*"}:${prevSize * 4}]`)
            prevCnt = 0
            prevSize = 0
            prevFree = null
        }
        while (block < heapEnd) {
            let bp = read32(block)
            let blockSize = bp & 0x7fffffff;
            let isFree = (bp & 0x80000000) != 0
            if (isFree !== prevFree || blockSize > 20)
                flush()
            prevFree = isFree
            prevSize += blockSize
            prevCnt++
            if (blockSize > 20)
                flush()

            if (isFree)
                totalFreeBlock += blockSize;
            else
                totalUsedBlock += blockSize;

            block += blockSize * 4;
        }
        flush()
        console.log(`free: ${totalFreeBlock * 4}`)
    }

    let uf2 = pxtc.UF2.parseFile(new Uint8Array(fs.readFileSync("built/binary.uf2")))

    let currClass = ""
    let classMap: pxt.Map<string> = {}
    for (let line of fs.readFileSync("built/binary.asm", "utf8").split(/\n/)) {
        let m = /(\w+)__C\d+_VT:/.exec(line)
        if (m) currClass = m[1]
        m = /(\d+)\s+;\s+class-id/.exec(line)
        if (currClass && m) {
            classMap[m[1]] = currClass
            currClass = ""
        }
    }

    let byCategory: pxt.Map<number> = {}
    let numByCategory: pxt.Map<number> = {}

    /*
    struct VTable {
        uint16_t numbytes;
        ValType objectType;
        uint8_t magic;
        PVoid *ifaceTable;
        BuiltInType classNo;
    };
    */
    for (let gcHeap = read32(findAddr("pxt::firstBlock")); gcHeap; gcHeap = read32(gcHeap)) {
        let heapSize = read32(gcHeap + 4)
        console.log(`*** GC heap ${hex(gcHeap)} size=${heapSize}`)
        let objPtr = gcHeap + 8
        let heapEnd = objPtr + heapSize
        while (objPtr < heapEnd) {
            let vtable = read32(objPtr)
            let numbytes = 0
            let category = ""
            let addWords = 0
            if (vtable & 2) {
                category = "free"
                numbytes = (vtable >> 2) << 2
            } else {
                vtable &= ~3
                let vt0 = read32(vtable)
                if ((vt0 >>> 24) != pxt.VTABLE_MAGIC) {
                    console.log(`Invalid vtable: ${hex(vt0)}`)
                    break
                }
                numbytes = vt0 & 0xffff
                let objectType = (vt0 >> 16) & 0xff
                let classNoEtc = read32(vtable + 8)
                let classNo = classNoEtc & 0xffff
                let word0 = read32(objPtr + 4)
                switch (classNo) {
                    case pxt.BuiltInType.BoxedString:
                        category = "string"
                        numbytes += (word0 & 0xffff) + 1
                        break
                    case pxt.BuiltInType.BoxedBuffer:
                        category = "buffer"
                        numbytes += word0
                        break
                    case pxt.BuiltInType.RefAction:
                        category = "action"
                        numbytes += (word0 & 0xffff) * 4
                        break
                    case pxt.BuiltInType.RefImage:
                        category = "image"
                        if (word0 & 1) {
                            numbytes += word0 >> 2
                        }
                        break
                    case pxt.BuiltInType.BoxedNumber:
                        category = "number"
                        break
                    case pxt.BuiltInType.RefCollection:
                        addWords = read32(objPtr + 8) >>> 16
                        category = "array sz=" + addWords
                        break
                    case pxt.BuiltInType.RefRefLocal:
                        category = "reflocal"
                        break
                    case pxt.BuiltInType.RefMap:
                        addWords = read32(objPtr + 8) >>> 16
                        category = "refmap sz=" + addWords
                        addWords <<= 1
                        break
                    default:
                        category = classMap[classNo + ""] || ("C_" + classNo)
                        break
                }
            }
            // console.log(`${hex(objPtr)} ${category} bytes=${numbytes}`)
            if (!byCategory[category]) {
                byCategory[category] = 0
                numByCategory[category] = 0
            }
            let numwords = (numbytes + 3) >> 2
            byCategory[category] += (addWords + numwords) * 4
            numByCategory[category]++
            objPtr += numwords * 4
        }
    }

    let cats = Object.keys(byCategory)
    cats.sort((a, b) => byCategory[b] - byCategory[a])
    let fidx = cats.indexOf("free")
    cats.splice(fidx, 1)
    cats.push("free")
    for (let c of cats) {
        console.log(`${byCategory[c]}\t${numByCategory[c]}\t${c}`)
    }

    function read32(addr: number) {
        if (addr >= memStart)
            return pxt.HF2.read32(mem, addr - memStart)
        let r = pxtc.UF2.readBytes(uf2, addr, 4)
        if (r && r.length == 4)
            return pxt.HF2.read32(r, 0)
        U.userError(`can't read memory at ${addr}`)
        return 0
    }
}

export async function dumplogAsync() {
    let addr = findAddr("codalLogStore")
    let buf = await getMemoryAsync(addr + 4, 1024)
    for (let i = 0; i < buf.length; ++i) {
        if (buf[i] == 0) {
            console.log("\n\n" + buf.slice(0, i).toString("utf8"))
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
