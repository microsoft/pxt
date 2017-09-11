/// <reference path="../typings/globals/node/index.d.ts"/>
/// <reference path="../built/pxtlib.d.ts"/>
/// <reference path="../built/pxtsim.d.ts"/>


(global as any).pxt = pxt;

import * as nodeutil from './nodeutil';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import * as hid from './hid';

import U = pxt.Util;
import Map = pxt.Map;

// abstract over build engine 
export interface BuildEngine {
    updateEngineAsync: () => Promise<void>;
    setPlatformAsync: () => Promise<void>;
    buildAsync: () => Promise<void>;
    patchHexInfo: (extInfo: pxtc.ExtensionInfo) => pxtc.HexInfo;
    prepBuildDirAsync: () => Promise<void>;
    buildPath: string;
    appPath: string;
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

function noopAsync() { return Promise.resolve() }

export const buildEngines: Map<BuildEngine> = {
    yotta: {
        updateEngineAsync: () => runYottaAsync(["update"]),
        buildAsync: () => runYottaAsync(["build"]),
        setPlatformAsync: () =>
            runYottaAsync(["target", pxt.appTarget.compileService.yottaTarget]),
        patchHexInfo: patchYottaHexInfo,
        prepBuildDirAsync: noopAsync,
        buildPath: "built/yt",
        moduleConfig: "module.json",
        deployAsync: msdDeployCoreAsync,
        appPath: "source"
    },

    platformio: {
        updateEngineAsync: noopAsync,
        buildAsync: () => runPlatformioAsync(["run"]),
        setPlatformAsync: noopAsync,
        patchHexInfo: patchPioHexInfo,
        prepBuildDirAsync: noopAsync,
        buildPath: "built/pio",
        moduleConfig: "platformio.ini",
        deployAsync: platformioDeployAsync,
        appPath: "src"
    },

    codal: {
        updateEngineAsync: updateCodalBuildAsync,
        buildAsync: () => runBuildCmdAsync("python", "build.py"),
        setPlatformAsync: noopAsync,
        patchHexInfo: patchCodalHexInfo,
        prepBuildDirAsync: prepCodalBuildDirAsync,
        buildPath: "built/codal",
        moduleConfig: "codal.json",
        deployAsync: msdDeployCoreAsync,
        appPath: "pxtapp"
    },

    dockermake: {
        updateEngineAsync: () => runBuildCmdAsync("npm", "install"),
        buildAsync: () => runDockerAsync(["make"]),
        setPlatformAsync: noopAsync,
        patchHexInfo: patchDockermakeHexInfo,
        prepBuildDirAsync: noopAsync,
        buildPath: "built/dockermake",
        moduleConfig: "package.json",
        deployAsync: msdDeployCoreAsync,
        appPath: "pxtapp"
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

function patchCodalHexInfo(extInfo: pxtc.ExtensionInfo) {
    let hexPath = thisBuild.buildPath + "/build/" + pxt.appTarget.compileService.codalBinary + ".hex"
    return {
        hex: fs.readFileSync(hexPath, "utf8").split(/\r?\n/)
    }
}

function patchDockermakeHexInfo(extInfo: pxtc.ExtensionInfo) {
    let hexPath = thisBuild.buildPath + "/bld/pxt-app.hex"
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
    return runPlatformioAsync(["run", "--target", "upload", "--target", "nobuild", "-v"])
        .finally(() => {
            pxt.log('Restoring ' + pioFirmwareHex())
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
        pxt.debug("Skipping C++ build.")
        return tasks
    }

    pxt.debug("writing build files to " + buildEngine.buildPath)

    let allFiles = U.clone(extInfo.generatedFiles)
    U.jsonCopyFrom(allFiles, extInfo.extensionFiles)

    let writeFiles = () => {
        for (let f of nodeutil.allFiles(buildEngine.buildPath + "/" + buildEngine.appPath, 8, true)) {
            let bn = f.slice(buildEngine.buildPath.length)
            bn = bn.replace(/\\/g, "/").replace(/^\//, "/")
            if (U.startsWith(bn, "/" + buildEngine.appPath + "/") && !allFiles[bn]) {
                pxt.log("removing stale " + bn)
                fs.unlinkSync(f)
            }
        }

        U.iterMap(allFiles, (fn, v) => {
            fn = buildEngine.buildPath + fn
            nodeutil.mkdirP(path.dirname(fn))
            let existing: string = null
            if (fs.existsSync(fn))
                existing = fs.readFileSync(fn, "utf8")
            if (existing !== v)
                fs.writeFileSync(fn, v)
        })
    }

    tasks = tasks
        .then(buildEngine.prepBuildDirAsync)
        .then(writeFiles)

    let saveCache = () => fs.writeFileSync(buildCachePath, JSON.stringify(buildCache, null, 4) + "\n")

    let modSha = U.sha256(extInfo.generatedFiles["/" + buildEngine.moduleConfig])
    let needDal = false
    if (buildCache.modSha !== modSha) {
        tasks = tasks
            .then(buildEngine.setPlatformAsync)
            .then(buildEngine.updateEngineAsync)
            .then(() => {
                buildCache.sha = ""
                buildCache.modSha = modSha
                saveCache();
                needDal = true
            })
    } else {
        pxt.debug("Skipping C++ build update.")
    }

    tasks = tasks
        .then(buildEngine.buildAsync)
        .then(() => {
            buildCache.sha = extInfo.sha
            saveCache()
            if (needDal)
                buildDalConst(buildEngine, mainPkg, true);
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

    pxt.log("*** " + ytCommand + " " + args.join(" "))
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
    pxt.log("*** platformio " + args.join(" "))
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

function runDockerAsync(args: string[]) {
    let fullpath = process.cwd() + "/" + thisBuild.buildPath + "/"
    let cs = pxt.appTarget.compileService
    return nodeutil.spawnAsync({
        cmd: "docker",
        args: ["run", "--rm", "-v", fullpath + ":/src", "-w", "/src", "-u", "build",
            cs.dockerImage].concat(args),
        cwd: thisBuild.buildPath
    })
}

let parseCppInt = pxt.cpp.parseCppInt;


export function codalGitAsync(...args: string[]) {
    return nodeutil.spawnAsync({
        cmd: "git",
        args: args,
        cwd: thisBuild.buildPath
    })
}


function prepCodalBuildDirAsync() {
    if (fs.existsSync(thisBuild.buildPath + "/.git/config"))
        return Promise.resolve()
    let cs = pxt.appTarget.compileService
    let pkg = "https://github.com/" + cs.githubCorePackage
    nodeutil.mkdirP("built")
    return nodeutil.runGitAsync("clone", pkg, thisBuild.buildPath)
        .then(() => codalGitAsync("checkout", cs.gittag))
}

function runBuildCmdAsync(cmd: string, ...args: string[]) {
    return nodeutil.spawnAsync({
        cmd,
        args,
        cwd: thisBuild.buildPath,
    })
}

function updateCodalBuildAsync() {
    let cs = pxt.appTarget.compileService
    return codalGitAsync("checkout", cs.gittag)
        .then(() => { }, e => { })
        .then(() => codalGitAsync("pull"))
        .then(() => codalGitAsync("checkout", cs.gittag))
}

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
                        pxt.log(`${fileName}(${lineNo}): #define conflict, ${n}`)
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
                        pxt.log(`${fileName}(${lineNo}): invalid enum initializer, ${ln}`)
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
        pxt.log(`rebuilding ${constName}...`)
        // TODO: DAL-specific code
        let incPath = buildEngine.buildPath + "/yotta_modules/microbit-dal/inc/"
        if (!fs.existsSync(incPath))
            incPath = buildEngine.buildPath + "/yotta_modules/codal/inc/";
        if (!fs.existsSync(incPath))
            incPath = buildEngine.buildPath
        if (!fs.existsSync(incPath))
            U.userError("cannot find " + incPath);
        let files = nodeutil.allFiles(incPath, 20).filter(fn => U.endsWith(fn, ".h"))
        files.sort(U.strcmp)
        let fc: Map<string> = {}
        for (let fn of files) {
            if (U.endsWith(fn, "Config.h")) continue
            if (fn.indexOf("/mbed-classic/") >= 0) continue
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
    const firmware = pxt.outputName()
    const encoding = pxt.isOutputText() ? "utf8" : "base64";

    if (pxt.appTarget.serial && pxt.appTarget.serial.useHF2) {
        let f = res.outfiles[pxtc.BINARY_UF2]
        let blocks = pxtc.UF2.parseFile(U.stringToUint8Array(atob(f)))
        return hid.initAsync()
            .then(dev => dev.flashAsync(blocks))
    }

    return getBoardDrivesAsync()
        .then(drives => filterDrives(drives))
        .then(drives => {
            if (drives.length == 0) {
                pxt.log("cannot find any drives to deploy to");
                return Promise.resolve(0);
            }
            pxt.log(`copying ${firmware} to ` + drives.join(", "));
            const writeHexFile = (filename: string) => {
                return writeFileAsync(path.join(filename, firmware), res.outfiles[firmware], encoding)
                    .then(() => pxt.log("   wrote hex file to " + filename));
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