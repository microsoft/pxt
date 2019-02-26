import * as path from 'path';
import * as nodeutil from './nodeutil';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as buildengine from './buildengine';
import * as commandParser from './commandparser';

import U = pxt.Util;


const openAsync = Promise.promisify(fs.open)
const closeAsync = Promise.promisify(fs.close) as (fd: number) => Promise<void>
const writeAsync = Promise.promisify(fs.write)

let gdbServer: pxt.GDBServer
let bmpMode = false

const execAsync: (cmd: string, options?: { cwd?: string }) => Promise<Buffer | string> = Promise.promisify(child_process.exec)

function getBMPSerialPortsAsync(): Promise<string[]> {
    if (process.platform == "win32") {
        return execAsync("wmic PATH Win32_SerialPort get DeviceID, PNPDeviceID")
            .then((buf: Buffer) => {
                let res: string[] = []
                buf.toString("utf8").split(/\n/).forEach(ln => {
                    let m = /^(COM\d+)\s+USB\\VID_(\w+)&PID_(\w+)&MI_(\w+)/.exec(ln)
                    if (m) {
                        const comp = m[1]
                        const vid = parseInt(m[2], 16)
                        const pid = parseInt(m[3], 16)
                        const mi = parseInt(m[4], 16)
                        if (vid == 0x1d50 && pid == 0x6018 && mi == 0) {
                            res.push(comp)
                        }
                    }
                })
                return res
            })
    }
    else if (process.platform == "darwin") {
        return execAsync("ioreg -p IOUSB -l -w 0")
            .then((buf: Buffer) => {
                let res: string[] = []
                let inBMP = false
                buf.toString("utf8").split(/\n/).forEach(ln => {
                    if (ln.indexOf("+-o Black Magic Probe") >= 0)
                        inBMP = true
                    if (!inBMP)
                        return
                    let m = /"USB Serial Number" = "(\w+)"/.exec(ln)
                    if (m) {
                        inBMP = false
                        res.push("/dev/cu.usbmodem" + m[1] + "1")
                    }
                })
                return res
            })
    } else if (process.platform == "linux") {
        // TODO
        return Promise.resolve([])
    } else {
        return Promise.resolve([])
    }
}

class SerialIO implements pxt.TCPIO {
    onData: (v: Uint8Array) => void;
    onError: (e: Error) => void;
    fd: number;
    id = 0
    trace = false

    constructor(public comName: string) { }

    connectAsync(): Promise<void> {
        return this.disconnectAsync()
            .then(() => {
                pxt.log("open GDB at " + this.comName)
                return openAsync(this.comName, "r+")
            })
            .then(fd => {
                this.fd = fd
                const id = ++this.id
                const buf = Buffer.alloc(128)
                const loop = () => fs.read(fd, buf, 0, buf.length, null, (err, nb, buf) => {
                    if (this.id != id)
                        return
                    if (nb > 0) {
                        let bb = buf.slice(0, nb)
                        if (this.trace)
                            pxt.log("R:" + bb.toString("utf8"))
                        if (this.onData)
                            this.onData(bb)
                        loop()
                    } else {
                        let msg = "GDB read error, nb=" + nb + err.message
                        if (this.trace) pxt.log(msg)
                        else pxt.debug(msg)
                        setTimeout(loop, 500)
                    }
                })
                loop()
            })
    }

    sendPacketAsync(pkt: Uint8Array): Promise<void> {
        if (this.trace)
            pxt.log("W:" + Buffer.from(pkt).toString("utf8"))
        return writeAsync(this.fd, pkt)
            .then(() => { })
    }

    error(msg: string): any {
        pxt.log(this.comName + ": " + msg)
    }

    disconnectAsync(): Promise<void> {
        if (this.fd == null)
            return Promise.resolve()
        this.id++
        const f = this.fd
        this.fd = null
        pxt.log("close GDB at " + this.comName)
        // try to elicit some response from the server, so that the read loop is tickled
        // and stops; without this the close() below hangs
        fs.write(f, "$?#78", () => { })
        return closeAsync(f)
            .then(() => {
            })
    }
}


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

        openocdPath = bmpMode ? "" : latest("openocd")
        gccPath = latest("arm-none-eabi-gcc")
    }

    openocdBin = path.join(openocdPath, "bin/openocd")

    if (process.platform == "win32")
        openocdBin += ".exe"

    let script = bmpMode ? "N/A" : pxt.appTarget.compile.openocdScript
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

let cachedMap = ""
let addrCache: pxt.Map<number>
function getMap() {
    if (!cachedMap)
        cachedMap = fs.readFileSync(codalBin() + ".map", "utf8")
    return cachedMap
}

function mangle(symbolName: string) {
    let m = /(.*)::(.*)/.exec(symbolName)
    return "_ZN" + m[1].length + m[1] + "L" + m[2].length + m[2] + "E"
}

function findAddr(symbolName: string) {
    if (!addrCache) {
        addrCache = {}
        let bss = ""
        for (let line of getMap().split(/\n/)) {
            line = line.trim()
            let m = /^\.bss\.(\w+)/.exec(line)
            if (m) bss = m[1]
            m = /0x0000000([0-9a-f]+)(\s+([:\w]+)\s*(= .*)?)?/.exec(line)
            if (m) {
                let addr = parseInt(m[1], 16)
                if (m[3]) addrCache[m[3]] = addr
                if (bss) {
                    addrCache[bss] = addr
                    bss = ""
                }
            }
        }
    }
    let addr = addrCache[symbolName]
    if (!addr)
        addr = addrCache[mangle(symbolName)]
    if (addr) {
        return addr
    } else {
        fatal(`Can't find ${symbolName} symbol in map`)
        return -1
    }
}

async function initGdbServerAsync() {
    let ports = await getBMPSerialPortsAsync()
    if (ports.length == 0) {
        pxt.log(`Black Magic Probe not detected; falling back to openocd`)
        return
    }
    bmpMode = true
    pxt.log(`detected Black Magic Probe at ${ports[0]}`)
    gdbServer = new pxt.GDBServer(new SerialIO(ports[0]))
    // gdbServer.trace = true
    await gdbServer.io.connectAsync()
    await gdbServer.initAsync()
    pxt.log(gdbServer.targetInfo)
    nodeutil.addCliFinalizer(() => {
        if (!gdbServer)
            return Promise.resolve()
        let g = gdbServer
        gdbServer = null
        return g.io.disconnectAsync()
    })
}

async function getMemoryAsync(addr: number, bytes: number) {
    if (gdbServer) {
        return gdbServer.readMemAsync(addr, bytes)
            .then((b: Uint8Array) => Buffer.from(b))
    }

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

type HeapRef = string | number
interface HeapObj {
    addr: string;
    tag: string;
    size: number;
    incoming?: HeapRef[];
    fields: pxt.Map<HeapRef>;
}

interface ClassInfo {
    name: string;
    fields: string[];
}

const FREE_MASK = 0x80000000
const ARRAY_MASK = 0x40000000
const PERMA_MASK = 0x20000000
const MARKED_MASK = 0x00000001
const ANY_MARKED_MASK = 0x00000003

function VAR_BLOCK_WORDS(vt: number) {
    return (((vt) << 12) >> (12 + 2))
}

export async function dumpheapAsync() {
    await initGdbServerAsync()

    let memStart = findAddr("_sdata")
    let memEnd = findAddr("_estack")
    console.log(`memory: ${hex(memStart)} - ${hex(memEnd)}`)
    let mem = await getMemoryAsync(memStart, memEnd - memStart)
    let heapDesc = findAddr("heap")
    let m = /\.bss\.heap\s+0x000000[a-f0-9]+\s+0x([a-f0-9]+)/.exec(getMap())
    let heapSz = 8
    let heapNum = parseInt(m[1], 16) / heapSz
    let vtablePtrs: pxt.Map<string> = {}

    getMap().replace(/0x0000000([0-9a-f]+)\s+vtable for (.*)/g, (f, a, cl) => {
        let n = parseInt(a, 16)
        vtablePtrs[hex(n)] = cl
        vtablePtrs[hex(n + 4)] = cl
        vtablePtrs[hex(n + 8)] = cl
        vtablePtrs[hex(n + 16)] = cl
        vtablePtrs[hex(n + 20)] = cl
        return ""
    })

    let pointerClassification: pxt.Map<string> = {}
    let numFibers = 0
    let numListeners = 0
    for (let q of ["runQueue", "sleepQueue", "waitQueue", "fiberPool", "idleFiber"]) {
        let addr = findAddr("codal::" + q)
        for (let ptr = read32(addr); ptr; ptr = read32(ptr + 6 * 4)) {
            pointerClassification[hex(ptr)] = "Fiber/" + q
            pointerClassification[hex(read32(ptr))] = "Fiber/TCB/" + q
            pointerClassification[hex(read32(ptr + 4))] = "Fiber/Stack/" + q
            pointerClassification[hex(read32(ptr + 8 * 4))] = "Fiber/PXT/" + q
            if (q == "idleFiber")
                break
            numFibers++
        }
    }

    let messageBus = read32(findAddr("codal::EventModel::defaultEventBus"))
    for (let ptr = read32(messageBus + 20); ptr; ptr = read32(ptr + 36)) {
        numListeners++
        pointerClassification[hex(ptr)] = "codal::Listener"
    }
    for (let ptr = read32(messageBus + 24); ptr; ptr = read32(ptr + 16)) {
        pointerClassification[hex(ptr)] = "codal::EventQueueItem"
    }

    for (let ptr = read32(findAddr("pxt::handlerBindings")); ptr; ptr = read32(ptr)) {
        pointerClassification[hex(ptr)] = "pxt::HandlerBinding"
    }

    console.log(`heaps at ${hex(heapDesc)}, num=${heapNum}`)
    let cnts: pxt.Map<number> = {}
    let fiberSize = 0
    for (let i = 0; i < heapNum; ++i) {
        let heapStart = read32(heapDesc + i * heapSz)
        let heapEnd = read32(heapDesc + i * heapSz + 4)
        console.log(`*** heap ${hex(heapStart)} ${heapEnd - heapStart} bytes`)

        let block = heapStart

        let totalFreeBlock = 0
        let totalUsedBlock = 0
        while (block < heapEnd) {
            let bp = read32(block)
            let blockSize = bp & 0x7fffffff;
            let isFree = (bp & 0x80000000) != 0

            // console.log(`${hex(block)} -> ${hex(bp)} ${blockSize * 4}`)
            let classification = classifyCPP(block, blockSize)
            if (U.startsWith(classification, "Fiber/"))
                fiberSize += blockSize * 4
            let mark = `[${isFree ? "F" : "U"}:${blockSize * 4} / ${classification}]`
            if (!cnts[mark])
                cnts[mark] = 0
            cnts[mark] += blockSize * 4

            if (isFree)
                totalFreeBlock += blockSize;
            else
                totalUsedBlock += blockSize;

            block += blockSize * 4;
        }
        console.log(`free: ${totalFreeBlock * 4}`)
    }

    {
        let keys = Object.keys(cnts)
        keys.sort((a, b) => cnts[b] - cnts[a])
        for (let k of keys) {
            console.log(`${cnts[k]}\t${k}`)
        }
    }

    let uf2 = pxtc.UF2.parseFile(new Uint8Array(fs.readFileSync("built/binary.uf2")))

    let currClass = ""
    let classMap: pxt.Map<ClassInfo> = {}
    let inIface = false
    let classInfo: ClassInfo
    for (let line of fs.readFileSync("built/binary.asm", "utf8").split(/\n/)) {
        let m = /(\w+)__C\d+_VT:/.exec(line)
        if (m) currClass = m[1]
        m = /\w+__C\d+_IfaceVT:/.exec(line)
        if (m) inIface = true
        m = /(\d+)\s+;\s+class-id/.exec(line)
        if (currClass && m) {
            classInfo = {
                name: currClass,
                fields: []
            }
            classMap[m[1]] = classInfo
            currClass = ""
        }

        if (inIface) {
            m = /\.short \d+, (\d+) ; (.*)/.exec(line)
            if (m) {
                if (m[2] == "the end") {
                    inIface = false
                } else if (m[1] != "0") {
                    classInfo.fields.push(m[2])
                }
            }
        }

    }

    let objects: pxt.Map<HeapObj> = {}

    let byCategory: pxt.Map<number> = {}
    let numByCategory: pxt.Map<number> = {}
    let maxFree = 0

    const string_inline_ascii_vt = findAddr("pxt::string_inline_ascii_vt")
    const string_inline_utf8_vt = findAddr("pxt::string_inline_utf8_vt")
    const string_cons_vt = findAddr("pxt::string_cons_vt")
    const string_skiplist16_vt = findAddr("pxt::string_skiplist16_vt")

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
        let fields: pxt.Map<HeapRef>

        while (objPtr < heapEnd) {
            let vtable = read32(objPtr)
            let numbytes = 0
            let category = ""
            let addWords = 0
            fields = {}
            if (vtable & FREE_MASK) {
                category = "free"
                numbytes = VAR_BLOCK_WORDS(vtable) << 2
                maxFree = Math.max(numbytes, maxFree)
            } else if (vtable & ARRAY_MASK) {
                numbytes = VAR_BLOCK_WORDS(vtable) << 2
                category = "arraybuffer sz=" + (numbytes >> 2)
                if (vtable & PERMA_MASK) {
                    category = "app_alloc sz=" + numbytes
                    let classification = classifyCPP(objPtr, numbytes >> 2)
                    if (classification != "?")
                        category = classification
                    if (U.startsWith(classification, "Fiber/"))
                        fiberSize += numbytes
                } else
                    category = "arraybuffer sz=" + (numbytes >> 2)
            } else {
                vtable &= ~ANY_MARKED_MASK
                let vt0 = read32(vtable)
                if ((vt0 >>> 24) != pxt.VTABLE_MAGIC) {
                    console.log(`Invalid vtable: at ${hex(objPtr)} *${hex(vtable)} = ${hex(vt0)}`)
                    break
                }
                numbytes = vt0 & 0xffff
                let objectType = (vt0 >> 16) & 0xff
                let classNoEtc = read32(vtable + 8)
                let classNo = classNoEtc & 0xffff
                let word0 = read32(objPtr + 4)
                let tmp = 0
                let len = 0
                switch (classNo) {
                    case pxt.BuiltInType.BoxedString:
                        if (vtable == string_inline_ascii_vt) {
                            category = "ascii_string"
                            numbytes = 4 + 2 + (word0 & 0xffff) + 1
                        } else if (vtable == string_inline_utf8_vt) {
                            category = "utf8_string"
                            numbytes = 4 + 2 + (word0 & 0xffff) + 1
                        } else if (vtable == string_skiplist16_vt) {
                            category = "skip_string"
                            numbytes = 4 + 2 + 2 + 4
                            fields[".data"] = hex(read32(objPtr + 8) - 4)
                        } else if (vtable == string_cons_vt) {
                            category = "cons_string"
                            numbytes = 4 + 4 + 4
                            fields["left"] = hex(read32(objPtr + 4))
                            fields["right"] = hex(read32(objPtr + 8))
                        } else {
                            console.log(`Invalid string vtable: ${hex(vtable)}`)
                            break
                        }
                        break
                    case pxt.BuiltInType.BoxedBuffer:
                        category = "buffer"
                        numbytes += word0
                        break
                    case pxt.BuiltInType.RefAction:
                        category = "action"
                        len = word0 & 0xffff
                        for (let i = 0; i < len; ++i) {
                            fields["" + i] = readRef(objPtr + (i + 3) * 4)
                        }
                        numbytes += len * 4
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
                        len = read32(objPtr + 8)
                        category = "array sz=" + (len >>> 16)
                        len &= 0xffff
                        fields["length"] = len
                        fields[".data"] = hex(word0 - 4)
                        for (let i = 0; i < len; ++i) {
                            fields["" + i] = readRef(word0 + i * 4)
                        }
                        break
                    case pxt.BuiltInType.RefRefLocal:
                        category = "reflocal"
                        fields["value"] = readRef(objPtr + 4)
                        break
                    case pxt.BuiltInType.RefMap:
                        len = read32(objPtr + 8)
                        category = "refmap sz=" + (len >>> 16)
                        len &= 0xffff
                        tmp = read32(objPtr + 12)
                        fields["length"] = len
                        fields[".keys"] = hex(word0 - 4)
                        fields[".values"] = hex(tmp - 4)
                        for (let i = 0; i < len; ++i) {
                            fields["k" + i] = readRef(word0 + i * 4)
                            fields["v" + i] = readRef(tmp + i * 4)
                        }
                        break
                    default:
                        if (classMap[classNo + ""]) {
                            let cinfo = classMap[classNo + ""]
                            category = cinfo.name
                            len = (numbytes - 4) >> 2
                            if (len != cinfo.fields.length)
                                fields["$error"] = "fieldMismatch"
                            for (let i = 0; i < len; ++i)
                                fields[cinfo.fields[i] || ".f" + i] = readRef(objPtr + (i + 1) * 4)
                        } else {
                            category = ("C_" + classNo)
                            len = (numbytes - 4) >> 2
                            for (let i = 0; i < len; ++i)
                                fields[".f" + i] = readRef(objPtr + (i + 1) * 4)

                        }
                        break
                }
            }
            // console.log(`${hex(objPtr)} vt=${hex(vtable)} ${category} bytes=${numbytes}`)
            if (!byCategory[category]) {
                byCategory[category] = 0
                numByCategory[category] = 0
            }
            let numwords = (numbytes + 3) >> 2
            let obj: HeapObj = {
                addr: hex(objPtr),
                tag: category,
                size: (addWords + numwords) * 4,
                fields: fields
            }
            objects[obj.addr] = obj
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

    console.log(`max. free block: ${maxFree} bytes`)
    console.log(`fibers: ${fiberSize} bytes, ${numFibers} fibers; ${numListeners} listeners`)

    let dmesg = getDmesg()
    let roots: pxt.Map<HeapRef[]> = {}

    dmesg
        .replace(/.*--MARK/, "")
        .replace(/^R(.*):0x([\da-f]+)\/(\d+)/img, (f, id, ptr, len) => {
            roots[id] = getRoots(parseInt(ptr, 16), parseInt(len), id == "P")
            return ""
        })

    for (let rootId of Object.keys(roots)) {
        for (let f of roots[rootId])
            mark(rootId, f)
    }

    let unreachable: string[] = []

    for (let o of U.values(objects)) {
        if (!o.incoming) {
            if (o.tag != "free")
                unreachable.push(o.addr)
        }
    }

    fs.writeFileSync("dump.json", JSON.stringify({
        unreachable,
        roots,
        dmesg,
        objects
    }, null, 1))

    // dgml output
    let dgml = `<DirectedGraph xmlns="http://schemas.microsoft.com/vs/2009/dgml">\n`;
    dgml += `<Nodes>\n`
    for (const addr of Object.keys(objects)) {
        const obj = objects[addr];
        dgml += `<Node Id="${addr}" Label="${obj.tag}" Size="${obj.size}" />\n`
    }
    dgml += `</Nodes>\n`
    dgml += `<Links>\n`
    for (const addr of Object.keys(objects)) {
        const obj = objects[addr];
        for (const fieldaddr of Object.keys(obj.fields)) {
            const field = obj.fields[fieldaddr];
            dgml += `<Link Source="${addr}" Target="${field}" Label="${fieldaddr}" />\n`
        }
    }
    dgml += `</Links>\n`
    dgml += `<Properties>
    <Property Id="Size" Label="Size" DataType="System.Int32" />
</Properties>\n`
    dgml += `</DirectedGraph>`;
    fs.writeFileSync("dump.dgml", dgml, { encoding: "utf8" });
    console.log(`written dump.dgml`);

    function mark(src: HeapRef, r: HeapRef) {
        if (typeof r == "string" && U.startsWith(r, "0x2")) {
            let o = objects[r]
            if (o) {
                if (!o.incoming) {
                    o.incoming = [src]
                    for (let f of U.values(o.fields))
                        mark(r, f)
                } else {
                    o.incoming.push(src)
                }
            } else {
                objects[r] = {
                    addr: r,
                    size: -1,
                    tag: "missing",
                    incoming: [src],
                    fields: {}
                }
            }
        }
    }

    function getRoots(start: number, len: number, encoded = false) {
        let refs: HeapRef[] = []
        for (let i = 0; i < len; ++i) {
            let addr = start + i * 4
            if (encoded) {
                let v = read32(addr)
                if (v & 1)
                    addr = v & ~1
            }
            refs.push(readRef(addr))
        }
        return refs
    }

    function readRef(addr: number): HeapRef {
        let v = read32(addr)
        if (!v) return "undefined"
        if (v & 1) {
            if (0x8000000 <= v && v <= 0x80f0000)
                return hex(v)
            return v >> 1
        }
        if (v & 2) {
            if (v == pxtc.taggedFalse)
                return "false"
            if (v == pxtc.taggedTrue)
                return "true"
            if (v == pxtc.taggedNaN)
                return "NaN"
            if (v == pxtc.taggedNull)
                return "null"
            return "tagged_" + v
        }
        return hex(v)
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

    function getDmesg() {
        let addr = findAddr("codalLogStore")
        let start = addr + 4 - memStart
        for (let i = 0; i < 1024; ++i) {
            if (i == 1023 || mem[start + i] == 0)
                return mem.slice(start, start + i).toString("utf8")
        }
        return ""
    }

    function classifyCPP(block: number, blockSize: number) {
        let w0 = read32(block + 4)
        let w1 = read32(block + 8)
        let hx = hex(w0)
        let classification = pointerClassification[hex(block + 4)]
        if (!classification)
            classification = vtablePtrs[hx]
        if (!classification) {
            if (blockSize == 1312 / 4)
                classification = "ST7735WorkBuffer"
            else if (blockSize == 1184 / 4)
                classification = "ZPWM_buffer"
            else if (w0 & 1 && (w0 >> 16) == 2)
                classification = "codal::BufferData"
            else
                classification = "?" // hx
        }
        return classification
    }
}

export async function dumplogAsync() {
    await initGdbServerAsync()
    let addr = findAddr("codalLogStore")
    let buf = await getMemoryAsync(addr + 4, 1024)
    for (let i = 0; i < buf.length; ++i) {
        if (buf[i] == 0) {
            console.log("\n\n" + buf.slice(0, i).toString("utf8"))
            break
        }
    }
}

export async function hwAsync(cmds: string[]) {
    await initGdbServerAsync()

    switch (cmds[0]) {
        case "rst":
        case "reset":
            await gdbServer.sendCmdAsync("R00", null)
            break
        case "boot":
            let bi = getBootInfo()
            if (bi.addr) {
                await gdbServer.write32Async(bi.addr, bi.boot)
            }
            await gdbServer.sendCmdAsync("R00", null)
            break
        case "log":
        case "dmesg":
            await dumplogAsync()
            break
    }
}

function getBootInfo() {
    let r = {
        addr: 0,
        boot: 0,
        app: 0
    }

    if (/at91samd/.test(pxt.appTarget.compile.openocdScript)) {
        let ramSize = pxt.appTarget.compile.ramSize || 0x8000
        r.addr = 0x20000000 + ramSize - 4
        r.app = 0xf02669ef
        r.boot = 0xf01669ef
    }

    return r
}

export async function startAsync(gdbArgs: string[]) {
    let elfFile = codalBin()
    if (!fs.existsSync(elfFile))
        fatal("compiled file not found: " + elfFile)

    let bmpPort = (await getBMPSerialPortsAsync())[0]
    let trg = ""
    let monReset = "monitor reset"
    let monResetHalt = "monitor reset halt"

    if (bmpPort) {
        bmpMode = true
        trg = "target extended-remote " + bmpPort
        trg += "\nmonitor swdp_scan\nattach 1"
        pxt.log("Using Black Magic Probe at " + bmpPort)
        monReset = "run"
        monResetHalt = "run"
    }

    let toolPaths = getOpenOcdPath()

    if (!bmpMode) {
        let oargs = toolPaths.args
        trg = "target remote | " + oargs.map(s => `"${s.replace(/\\/g, "/")}"`).join(" ")
        pxt.log("starting openocd: " + oargs.join(" "))
    }

    let binfo = getBootInfo()

    let goToApp = binfo.addr ? `set {int}(${binfo.addr}) = ${binfo.boot}` : ""
    let goToBl = binfo.addr ? `set {int}(${binfo.addr}) = ${binfo.boot}` : ""

    // use / not \ for paths on Windows; otherwise gdb has issue starting openocd
    fs.writeFileSync("built/openocd.gdb",
        `
${trg}
define rst
  set confirm off
  ${goToApp}
  ${monResetHalt}
  continue
  set confirm on
end
define boot
  set confirm off
  ${goToBl}
  ${monReset}
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
define bpanic
  b target_panic
end
define bfault
  b handleHardFault
end
echo \\npxt commands\\n
echo    rst: command to re-run program from start (set your breakpoints first!).\\n
echo    boot: to go into bootloader\\n
echo    log: to dump DMESG\\n
echo    exn: to display exception info.\\n
echo    bpanic: to break in target_panic\\n
echo    bfault: to break on a hard fault, run 'exn' after\\n
echo \\ngdb (basic) commands\\n
echo    s: step, n: step over, fin: step out\\n
echo    l: line context\\n
echo    bt: for stacktrace\\n\\n
echo More help at https://makecode.com/cli/gdb\\n\\n
`)


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
