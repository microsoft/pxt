import * as nodeutil from './nodeutil';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

import U = pxt.Util;
import Cloud = pxt.Cloud;
import Map = pxt.Map;

import * as elf from './elf';

let execAsync: (cmd: string, options?: { cwd?: string }) => Promise<Buffer> = Promise.promisify(child_process.exec)

export function getLibDirsAsync() {
    let libdirs = {
        libgccPath: "",
        libcPath: ""
    }

    let arch = "armv6-m"
    return execAsync("arm-none-eabi-gcc -print-libgcc-file-name")
        .then(buf => {
            let p = buf.toString("utf8").trim().replace("libgcc.a", "")
            libdirs.libgccPath = path.join(p, arch)
            return execAsync("arm-none-eabi-gcc -print-sysroot")
        })
        .then(buf => {
            libdirs.libcPath = path.join(buf.toString("utf8").trim(), "lib", arch)
        })
        .then(() => {
            return libdirs
        })
}

function allFiles(top: string, maxDepth = 8, allowMissing = false): string[] {
    let res: string[] = []
    if (allowMissing && !fs.existsSync(top)) return res
    for (let p of fs.readdirSync(top)) {
        if (p[0] == ".") continue;
        let inner = top + "/" + p
        let st = fs.statSync(inner)
        if (st.isDirectory()) {
            if (maxDepth > 1)
                U.pushRange(res, allFiles(inner, maxDepth - 1))
        } else {
            res.push(inner)
        }
    }
    return res
}

function onlyExts(files: string[], exts: string[]) {
    return files.filter(f => exts.indexOf(path.extname(f)) >= 0)
}

export function elfAsync(fn: string) {
    let targetName = "bbc-microbit-classic-gcc"
    return getLibDirsAsync()
        .then(libdirs => {
            let dirmode = false
            if (!fn) fn = "."
            let st = fs.statSync(fn)
            let files = [fn]
            let hexFiles: string[] = []
            if (st.isDirectory()) {
                let trgDir = fn + "/yotta_targets/" + targetName + "/"
                let bootloader = onlyExts(allFiles(trgDir + "bootloader", 1), [".hex"])
                let softdevice = onlyExts(allFiles(trgDir + "softdevice", 1), [".hex"])
                hexFiles = bootloader.concat(softdevice)
                if (bootloader.length != 1 || softdevice.length != 1) {
                    U.userError(`static .hex files not found (or too many): ${hexFiles.join()}`)
                }
                dirmode = true
                files = allFiles(fn + "/build/" + targetName, 100).filter(f =>
                    f.indexOf("/ym/") >= 0 ? U.endsWith(f, ".a") : U.endsWith(f, ".o"))
                files.sort(U.strcmp)
                //files.push(libdirs.libgccPath + "/crtbegin.o")
                files.push(libdirs.libcPath + "/crt0.o")
            }
            let isLib = (f: string) => U.endsWith(f, ".a") // && !/microbit-dal\.a/.test(f)
            let yottaLibs = files.filter(isLib)
            files = files.filter(f => !isLib(f))
            let objInfos: elf.FileInfo[] = []
            for (let f of files) {
                console.log(f)
                let buf = fs.readFileSync(f)
                if (U.endsWith(f, ".a")) {
                    let ar = elf.readArFile(f, buf)
                    for (let e of ar.entries) {
                        if (e.filename == "/" || e.filename == "//")
                            continue
                        let bb = elf.getArEntry(ar, e.offset)
                        let ff = f + "/" + e.filename
                        let json = elf.elfToJson(path.basename(f) + "/" + e.filename, bb.buf)
                        objInfos.push(json)
                    }
                } else {
                    let json = elf.elfToJson(path.basename(f), buf)
                    objInfos.push(json)
                }
            }

            let filenames = [
                "libc_nano.a",
                "libm.a",
                "libnosys.a",
                "libstdc++_nano.a",
                "libsupc++_nano.a"
            ].map(f => path.join(libdirs.libcPath, f))
            filenames.push(path.join(libdirs.libgccPath, "libgcc.a"))
            if (!dirmode) filenames = []
            filenames = yottaLibs.concat(filenames)
            let libs = filenames.map(fn => elf.readArFile(fn, fs.readFileSync(fn), true))
            let total = elf.linkInfos(objInfos, libs)
            fs.writeFileSync("elf.linkmap", total.depInfo)
            delete total.depInfo
            let hexentries = U.concat(hexFiles.map(n => elf.readHexFile(fs.readFileSync(n))))
            total.hexEntries = hexentries
            fs.writeFileSync("elf.json", JSON.stringify(total, null, 1))
            let ss = JSON.stringify(total)
            let buf: Buffer = zlib.deflateSync(new Buffer(ss, "utf8"))
            console.log(`Size: ${ss.length} / ${buf.length} compressed`)
            let lres = elf.linkBinary(total)
            console.log(lres.sizes)
            fs.writeFileSync("elf.hex", lres.hex)
            fs.writeFileSync("elf.map", lres.map)
        })
}

