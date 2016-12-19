/// <reference path="../typings/node/node.d.ts"/>
/// <reference path="../built/pxtlib.d.ts"/>
/// <reference path="../built/pxtsim.d.ts"/>


(global as any).pxt = pxt;

import * as nodeutil from './nodeutil';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

import U = pxt.Util;
import Map = pxt.Map;

// abstract over build engine 
export interface BuildEngine {
    updateEngineAsync: () => Promise<void>;
    setPlatformAsync: () => Promise<void>;
    buildAsync: () => Promise<void>;
    patchHexInfo: (extInfo: pxtc.ExtensionInfo) => pxtc.HexInfo;
    buildPath: string;
    moduleConfig: string;
    deployAsync?: (r: pxtc.CompileResult) => Promise<void>;
}

// abstract over C++ runtime target (currently the DAL)
export interface TargetRuntime {
    includePath: string;
}

interface BuildCache {
    sha?: string;
    modSha?: string;
}

export const buildEngines: Map<BuildEngine> = {
    yotta: {
        updateEngineAsync: () => { return runYottaAsync(["update"]) },
        buildAsync: () => { return runYottaAsync(["build"]) },
        setPlatformAsync: () => {
            return runYottaAsync(["target", pxt.appTarget.compileService.yottaTarget])
        },
        patchHexInfo: patchYottaHexInfo,
        buildPath: "built/yt",
        moduleConfig: "module.json",
        deployAsync: msdDeployCoreAsync
    },

    platformio: {
        updateEngineAsync: () => Promise.resolve(),
        buildAsync: () => { return runPlatformioAsync(["run"]) },
        setPlatformAsync: () => Promise.resolve(),
        patchHexInfo: patchPioHexInfo,
        buildPath: "built/pio",
        moduleConfig: "platformio.ini",
        deployAsync: platformioDeployAsync,
    },
}

// once we have a different build engine, set this appropriately
export var thisBuild = buildEngines['yotta']

function patchYottaHexInfo(extInfo: pxtc.ExtensionInfo) {
    let buildEngine = buildEngines['yotta']
    let hexPath = buildEngine.buildPath + "/build/" + pxt.appTarget.compileService.yottaTarget
        + "/source/" + pxt.appTarget.compileService.yottaBinary;

    return {
        hex: fs.readFileSync(hexPath, "utf8").split(/\r?\n/)
    }
}

function pioFirmwareHex() {
    let buildEngine = buildEngines['platformio']
    return buildEngine.buildPath + "/.pioenvs/myenv/firmware.hex"
}

function patchPioHexInfo(extInfo: pxtc.ExtensionInfo) {
    return {
        hex: fs.readFileSync(pioFirmwareHex(), "utf8").split(/\r?\n/)
    }
}

function platformioDeployAsync(r: pxtc.CompileResult) {
    if (pxt.appTarget.compile.useUF2) return msdDeployCoreAsync(r);
    else return platformioUploadAsync(r);
}

function platformioUploadAsync(r: pxtc.CompileResult) {
    // TODO maybe platformio has some option to do this?
    let buildEngine = buildEngines['platformio']
    let prevHex = fs.readFileSync(pioFirmwareHex())
    fs.writeFileSync(pioFirmwareHex(), r.outfiles[pxtc.BINARY_HEX])
    return runPlatformioAsync(["run", "--target", "upload", "-v"])
        .finally(() => {
            console.log('Restoring ' + pioFirmwareHex())
            fs.writeFileSync(pioFirmwareHex(), prevHex)
        })
}

export function buildHexAsync(buildEngine: BuildEngine, mainPkg: pxt.MainPackage, extInfo: pxtc.ExtensionInfo) {
    let tasks = Promise.resolve()
    let buildCachePath = buildEngine.buildPath + "/buildcache.json"
    let buildCache: BuildCache = {}
    if (fs.existsSync(buildCachePath)) {
        buildCache = nodeutil.readJson(buildCachePath)
    }

    if (buildCache.sha == extInfo.sha) {
        console.log("Skipping build.")
        return tasks
    }

    console.log("Writing build files to " + buildEngine.buildPath)

    let allFiles = U.clone(extInfo.generatedFiles)
    U.jsonCopyFrom(allFiles, extInfo.extensionFiles)

    U.iterMap(allFiles, (fn, v) => {
        fn = buildEngine.buildPath + fn
        nodeutil.mkdirP(path.dirname(fn))
        let existing: string = null
        if (fs.existsSync(fn))
            existing = fs.readFileSync(fn, "utf8")
        if (existing !== v)
            fs.writeFileSync(fn, v)
    })

    let saveCache = () => fs.writeFileSync(buildCachePath, JSON.stringify(buildCache, null, 4) + "\n")

    let modSha = U.sha256(extInfo.generatedFiles["/" + buildEngine.moduleConfig])
    if (buildCache.modSha !== modSha) {
        tasks = tasks
            .then(() => buildEngine.setPlatformAsync())
            .then(() => buildEngine.updateEngineAsync())
            .then(() => {
                buildCache.sha = ""
                buildCache.modSha = modSha
                saveCache();
                buildDalConst(buildEngine, mainPkg, true);
            })
    } else {
        console.log("Skipping build update.")
    }

    tasks = tasks
        .then(() => buildEngine.buildAsync())
        .then(() => {
            buildCache.sha = extInfo.sha
            saveCache()
        })

    return tasks
}

function runYottaAsync(args: string[]) {
    let ypath: string = process.env["YOTTA_PATH"]
    let ytCommand = "yotta"
    let env = U.clone(process.env)
    if (/;[A-Z]:\\/.test(ypath)) {
        for (let pp of ypath.split(";")) {
            let q = path.join(pp, "yotta.exe")
            if (fs.existsSync(q)) {
                ytCommand = q
                env["PATH"] = env["PATH"] + ";" + ypath
                break
            }
        }
    }

    console.log("*** " + ytCommand + " " + args.join(" "))
    let child = child_process.spawn("yotta", args, {
        cwd: thisBuild.buildPath,
        stdio: "inherit",
        env: env
    })
    return new Promise<void>((resolve, reject) => {
        child.on("close", (code: number) => {
            if (code === 0) resolve()
            else reject(new Error("yotta " + args.join(" ") + ": exit code " + code))
        })
    })
}

function runPlatformioAsync(args: string[]) {
    console.log("*** platformio " + args.join(" "))
    let child = child_process.spawn("platformio", args, {
        cwd: thisBuild.buildPath,
        stdio: "inherit",
        env: process.env
    })
    return new Promise<void>((resolve, reject) => {
        child.on("close", (code: number) => {
            if (code === 0) resolve()
            else reject(new Error("platformio " + args.join(" ") + ": exit code " + code))
        })
    })
}

let parseCppInt = pxt.cpp.parseCppInt;

// TODO: DAL specific code should be lifted out
export function buildDalConst(buildEngine: BuildEngine, mainPkg: pxt.MainPackage, force = false) {
    let constName = "dal.d.ts"
    let vals: Map<string> = {}
    let done: Map<string> = {}

    function isValidInt(v: string) {
        return /^-?(\d+|0[xX][0-9a-fA-F]+)$/.test(v)
    }

    function extractConstants(fileName: string, src: string, dogenerate = false): string {
        let lineNo = 0
        // let err = (s: string) => U.userError(`${fileName}(${lineNo}): ${s}\n`)
        let outp = ""
        let inEnum = false
        let enumVal = 0
        let defineVal = (n: string, v: string) => {
            v = v.trim()
            if (parseCppInt(v) != null) {
                let curr = U.lookup(vals, n)
                if (curr == null || curr == v) {
                    vals[n] = v
                    if (dogenerate && !done[n]) {
                        outp += `    ${n} = ${v},\n`
                        done[n] = v
                    }
                } else {
                    vals[n] = "?"
                    // TODO: DAL-specific code
                    if (dogenerate && !/^MICROBIT_DISPLAY_(ROW|COLUMN)_COUNT$/.test(n))
                        console.log(`${fileName}(${lineNo}): #define conflict, ${n}`)
                }
            } else {
                vals[n] = "?" // just in case there's another more valid entry
            }
        }
        src.split(/\r?\n/).forEach(ln => {
            ++lineNo
            ln = ln.replace(/\/\/.*/, "").replace(/\/\*.*/g, "")
            let m = /^\s*#define\s+(\w+)\s+(.*)$/.exec(ln)
            if (m) {
                defineVal(m[1], m[2])
            }

            if (inEnum && /}/.test(ln))
                inEnum = false

            if (/^\s*enum\s+(\w+)/.test(ln)) {
                inEnum = true;
                enumVal = -1;
            }

            if (inEnum && (m = /^\s*(\w+)\s*(=\s*(.*?))?,?\s*$/.exec(ln))) {
                let v = m[3]
                if (v) {
                    enumVal = parseCppInt(v)
                    if (enumVal == null) {
                        console.log(`${fileName}(${lineNo}): invalid enum initializer, ${ln}`)
                        inEnum = false
                        return
                    }
                } else {
                    enumVal++
                    v = enumVal + ""
                }
                defineVal(m[1], v)
            }
        })
        return outp
    }

    if (mainPkg && mainPkg.getFiles().indexOf(constName) >= 0 &&
        (force || !fs.existsSync(constName))) {
        console.log(`rebuilding ${constName}...`)
        // TODO: DAL-specific code
        let incPath = buildEngine.buildPath + "/yotta_modules/microbit-dal/inc/"
        if (!fs.existsSync(incPath))
            incPath = buildEngine.buildPath + "/yotta_modules/codal/inc/"
        let files = nodeutil.allFiles(incPath).filter(fn => U.endsWith(fn, ".h"))
        files.sort(U.strcmp)
        let fc: Map<string> = {}
        for (let fn of files) {
            if (U.endsWith(fn, "Config.h")) continue
            fc[fn] = fs.readFileSync(fn, "utf8")
        }
        files = Object.keys(fc)

        // pre-pass - detect conflicts
        for (let fn of files) {
            extractConstants(fn, fc[fn])
        }

        let consts = "// Auto-generated. Do not edit.\ndeclare const enum DAL {\n"
        for (let fn of files) {
            consts += "    // " + fn.replace(/\\/g, "/") + "\n"
            consts += extractConstants(fn, fc[fn], true)
        }
        consts += "}\n"
        fs.writeFileSync(constName, consts)
    }
}

const writeFileAsync: any = Promise.promisify(fs.writeFile)
const execAsync: (cmd: string, options?: { cwd?: string }) => Promise<Buffer> = Promise.promisify(child_process.exec)
const readDirAsync = Promise.promisify(fs.readdir)

function msdDeployCoreAsync(res: ts.pxtc.CompileResult) {
    const firmware = pxt.appTarget.compile.useUF2 ? ts.pxtc.BINARY_UF2 : ts.pxtc.BINARY_HEX;
    const encoding = pxt.appTarget.compile.useUF2 ? "base64" : "utf8";
    return getBoardDrivesAsync()
        .then(drives => filterDrives(drives))
        .then(drives => {
            if (drives.length == 0) {
                console.log("cannot find any drives to deploy to");
                return Promise.resolve(0);
            }
            console.log(`copying ${firmware} to ` + drives.join(", "));
            const writeHexFile = (filename: string) => {
                return writeFileAsync(path.join(filename, firmware), res.outfiles[firmware], encoding)
                    .then(() => console.log("   wrote hex file to " + filename));
            };
            return Promise.map(drives, d => writeHexFile(d))
                .then(() => drives.length);
        }).then(() => { });
}

function getBoardDrivesAsync(): Promise<string[]> {
    if (process.platform == "win32") {
        const rx = new RegExp("^([A-Z]:)\\s+(\\d+).* " + pxt.appTarget.compile.deployDrives)
        return execAsync("wmic PATH Win32_LogicalDisk get DeviceID, VolumeName, FileSystem, DriveType")
            .then(buf => {
                let res: string[] = []
                buf.toString("utf8").split(/\n/).forEach(ln => {
                    let m = rx.exec(ln)
                    if (m && m[2] == "2") {
                        res.push(m[1] + "/")
                    }
                })
                return res
            })
    }
    else if (process.platform == "darwin") {
        const rx = new RegExp(pxt.appTarget.compile.deployDrives)
        return readDirAsync("/Volumes")
            .then(lst => lst.filter(s => rx.test(s)).map(s => "/Volumes/" + s + "/"))
    } else if (process.platform == "linux") {
        const rx = new RegExp(pxt.appTarget.compile.deployDrives)
        const user = process.env["USER"]
        return readDirAsync(`/media/${user}`)
            .then(lst => lst.filter(s => rx.test(s)).map(s => `/media/${user}/${s}/`))
    } else {
        return Promise.resolve([])
    }
}

function filterDrives(drives: string[]): string[] {
    const marker = pxt.appTarget.compile.deployFileMarker;
    if (!marker) return drives;
    return drives.filter(d => {
        try {
            return fs.existsSync(path.join(d, marker));
        } catch (e) {
            return false;
        }
    });
}