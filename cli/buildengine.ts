/// <reference path="../built/pxtlib.d.ts"/>
/// <reference path="../built/pxtsim.d.ts"/>


(global as any).pxt = pxt;

import * as nodeutil from './nodeutil';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import { promisify } from "util";
import * as hid from './hid';

import U = pxt.Util;
import Map = pxt.Map;

// abstract over build engine
export interface BuildEngine {
    id: string;
    updateEngineAsync: () => Promise<void>;
    setPlatformAsync: () => Promise<void>;
    buildAsync: () => Promise<void>;
    patchHexInfo: (extInfo: pxtc.ExtensionInfo) => pxtc.HexInfo;
    prepBuildDirAsync: () => Promise<void>;
    buildPath: string;
    appPath: string;
    moduleConfig: string;
    outputPath?: string;
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
        id: "yotta",
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

    dockeryotta: {
        id: "dockeryotta",
        updateEngineAsync: () => runDockerYottaAsync(["yotta", "update"]),
        buildAsync: () => runDockerYottaAsync(["yotta", "build"]),
        setPlatformAsync: () =>
            runDockerYottaAsync(["yotta", "target", pxt.appTarget.compileService.yottaTarget]),
        patchHexInfo: patchYottaHexInfo,
        prepBuildDirAsync: noopAsync,
        buildPath: "built/dockeryt",
        moduleConfig: "module.json",
        deployAsync: msdDeployCoreAsync,
        appPath: "source"
    },

    platformio: {
        id: "platformio",
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
        id: "codal",
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

    dockercodal: {
        id: "dockercodal",
        updateEngineAsync: updateCodalBuildAsync,
        buildAsync: () => runDockerAsync(["python", "build.py"]),
        setPlatformAsync: noopAsync,
        patchHexInfo: patchCodalHexInfo,
        prepBuildDirAsync: prepCodalBuildDirAsync,
        buildPath: "built/dockercodal",
        moduleConfig: "codal.json",
        deployAsync: msdDeployCoreAsync,
        appPath: "pxtapp"
    },

    dockermake: {
        id: "dockermake",
        updateEngineAsync: () => runBuildCmdAsync(nodeutil.addCmd("npm"), "install"),
        buildAsync: () => runDockerAsync(["make", "-j8"]),
        setPlatformAsync: noopAsync,
        patchHexInfo: patchDockermakeHexInfo,
        prepBuildDirAsync: noopAsync,
        buildPath: "built/dockermake",
        moduleConfig: "package.json",
        deployAsync: msdDeployCoreAsync,
        outputPath: "bld/pxt-app.elf",
        appPath: "pxtapp"
    },

    dockercross: {
        id: "dockercross",
        updateEngineAsync: () => runBuildCmdAsync(nodeutil.addCmd("npm"), "install"),
        buildAsync: () => runDockerAsync(["make"]),
        setPlatformAsync: noopAsync,
        patchHexInfo: patchDockerCrossHexInfo,
        prepBuildDirAsync: noopAsync,
        buildPath: "built/dockercross",
        moduleConfig: "package.json",
        deployAsync: noopAsync,
        appPath: "pxtapp"
    },

    dockerespidf: {
        id: "dockerespidf",
        updateEngineAsync: noopAsync,
        buildAsync: () => runDockerAsync(["make"]),
        setPlatformAsync: noopAsync,
        patchHexInfo: patchDockerEspIdfHexInfo,
        prepBuildDirAsync: noopAsync,
        buildPath: "built/dockerespidf",
        moduleConfig: "sdkconfig.defaults",
        deployAsync: noopAsync,
        appPath: "main"
    },

    cs: {
        id: "cs",
        updateEngineAsync: noopAsync,
        buildAsync: () => runBuildCmdAsync(getCSharpCommand(), "-t:library", "-out:pxtapp.dll", "lib.cs"),
        setPlatformAsync: noopAsync,
        patchHexInfo: patchCSharpDll,
        prepBuildDirAsync: noopAsync,
        buildPath: "built/cs",
        moduleConfig: "module.json",
        deployAsync: buildFinalCsAsync,
        appPath: "pxtapp"
    },
}

// once we have a different build engine, set this appropriately
export let thisBuild = buildEngines['yotta']

export function setThisBuild(b: BuildEngine) {
    if (pxt.appTarget.compileService.dockerImage && !process.env["PXT_NODOCKER"]) {
        if (b === buildEngines["codal"])
            b = buildEngines["dockercodal"];
        if (b === buildEngines["yotta"])
            b = buildEngines["dockeryotta"];
    }
    pxt.debug(`set build engine: ${b.id}`)
    thisBuild = b;
}

function patchYottaHexInfo(extInfo: pxtc.ExtensionInfo) {
    let buildEngine = thisBuild
    let hexPath = buildEngine.buildPath + "/build/" + pxt.appTarget.compileService.yottaTarget.split("@")[0]
        + "/source/" + pxt.appTarget.compileService.yottaBinary;

    return {
        hex: fs.readFileSync(hexPath, "utf8").split(/\r?\n/)
    }
}

function patchCodalHexInfo(extInfo: pxtc.ExtensionInfo) {
    let bin = pxt.appTarget.compileService.codalBinary
    let hexPath = thisBuild.buildPath + "/build/" + bin + ".hex"
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

function patchDockerCrossHexInfo(extInfo: pxtc.ExtensionInfo) {
    let hexPath = thisBuild.buildPath + "/bld/all.tgz.b64"
    return {
        hex: fs.readFileSync(hexPath, "utf8").split(/\r?\n/)
    }
}

function patchDockerEspIdfHexInfo(extInfo: pxtc.ExtensionInfo) {
    let hexPath = thisBuild.buildPath + "/build/pxtapp.b64"
    return {
        hex: fs.readFileSync(hexPath, "utf8").split(/\r?\n/)
    }
}

function patchCSharpDll(extInfo: pxtc.ExtensionInfo) {
    let hexPath = thisBuild.buildPath + "/lib.cs"
    return {
        hex: [fs.readFileSync(hexPath, "utf8")]
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

export function buildHexAsync(buildEngine: BuildEngine, mainPkg: pxt.MainPackage, extInfo: pxtc.ExtensionInfo, forceBuild: boolean) {
    let tasks = Promise.resolve()
    let buildCachePath = buildEngine.buildPath + "/buildcache.json"
    let buildCache: BuildCache = {}
    if (fs.existsSync(buildCachePath)) {
        buildCache = nodeutil.readJson(buildCachePath)
    }

    if (!forceBuild && (buildCache.sha == extInfo.sha && !process.env["PXT_RUNTIME_DEV"])) {
        pxt.debug("Skipping C++ build.")
        return tasks
    }

    pxt.debug("writing build files to " + buildEngine.buildPath)

    let allFiles = U.clone(extInfo.generatedFiles)
    U.jsonCopyFrom(allFiles, extInfo.extensionFiles)

    let writeFiles = () => {
        for (let f of nodeutil.allFiles(buildEngine.buildPath + "/" + buildEngine.appPath, { maxDepth: 8, allowMissing: true })) {
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
                nodeutil.writeFileSync(fn, v)
        })
    }

    tasks = tasks
        .then(buildEngine.prepBuildDirAsync)
        .then(writeFiles)

    let saveCache = () => fs.writeFileSync(buildCachePath, JSON.stringify(buildCache, null, 4) + "\n")

    let modSha = U.sha256(extInfo.generatedFiles["/" + buildEngine.moduleConfig])
    let needDal = false
    if (buildCache.modSha !== modSha || forceBuild) {
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
        pxt.debug(`Skipping C++ build update.`)
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

function runDockerAsync(args: string[], flags?: string[]) {
    if (process.env["PXT_NODOCKER"] == "force") {
        const cmd = args.shift()
        return nodeutil.spawnAsync({
            cmd,
            args,
            cwd: thisBuild.buildPath
        })
    } else {
        let fullpath = process.cwd() + "/" + thisBuild.buildPath + "/"
        let cs = pxt.appTarget.compileService
        let dargs = cs.dockerArgs || ["-u", "build"]
        let mountArg = fullpath + ":/src"

        // this speeds up docker build a lot on macOS,
        // see https://docs.docker.com/docker-for-mac/osxfs-caching/
        if (process.platform == "darwin")
            mountArg += ":delegated"

        let fullArgs = ["--rm", "-v", mountArg, "-w", "/src", ...dargs, cs.dockerImage, ...args];
        if (flags) {
            fullArgs = [...flags, ...fullArgs];
        }

        return nodeutil.spawnAsync({
            cmd: "docker",
            args: ["run", ...fullArgs],
            cwd: thisBuild.buildPath
        })
    }
}

function runDockerYottaAsync(args: string[]) {
    let fullpath = process.cwd() + "/" + thisBuild.buildPath + "/"

    fs.copyFileSync(path.join(__dirname, "prepYotta.js"), path.join(fullpath, "prepYotta.js"));

    let argVariable = args.join(" ");

    return runDockerAsync(["/bin/bash", "-c", `node prepYotta.js; ${argVariable}`], ["--env", "GITHUB_ACCESS_TOKEN"])
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
        .then(
            () => /v\d+/.test(cs.gittag) ? Promise.resolve() : codalGitAsync("pull"),
            e =>
                codalGitAsync("checkout", "master")
                    .then(() => codalGitAsync("pull")))
        .then(() => codalGitAsync("checkout", cs.gittag))
}

// TODO: DAL specific code should be lifted out
export function buildDalConst(buildEngine: BuildEngine, mainPkg: pxt.MainPackage, rebuild = false,
    create = false) {
    const constName = "dal.d.ts";
    let constPath = constName;
    const config = mainPkg && mainPkg.config;
    const corePackage = config && config.dalDTS && config.dalDTS.corePackage;
    if (corePackage)
        constPath = path.join(corePackage, constName);
    let vals: Map<string> = {}
    let done: Map<string> = {}
    let excludeSyms: string[] = []

    function expandInt(s: string): number {
        s = s.trim()
        let existing = U.lookup(vals, s)
        if (existing != null && existing != "?")
            s = existing

        let mm = /^\((.*)\)/.exec(s)
        if (mm) s = mm[1]

        let m = /^(\w+)\s*([\+\|])\s*(.*)$/.exec(s)
        if (m) {
            let k = expandInt(m[1])
            if (k != null)
                return m[2] == "+" ? k + expandInt(m[3]) : k | expandInt(m[3])
        }
        let pp = parseCppInt(s)
        if (pp != null) return pp
        return null
    }

    function extractConstants(fileName: string, src: string, dogenerate = false): string {
        let lineNo = 0
        // let err = (s: string) => U.userError(`${fileName}(${lineNo}): ${s}\n`)
        let outp = ""
        let inEnum = false
        let enumVal = 0
        let defineVal = (n: string, v: string) => {
            if (excludeSyms.some(s => U.startsWith(n, s)))
                return
            let parsed = expandInt(v)
            if (parsed != null) {
                v = parsed.toString()
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
                    if (dogenerate && !/^MICROBIT_DISPLAY_(ROW|COLUMN)_COUNT|PXT_VTABLE_SHIFT$/.test(n))
                        pxt.log(`${fileName}(${lineNo}): #define conflict, ${n}`)
                }
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

            const shouldExpand = inEnum && (m = /^\s*(\w+)\s*(=\s*(.*?))?,?\s*$/.exec(ln));
            if (shouldExpand) {
                let v = m[3]
                if (v) {
                    enumVal = expandInt(v)
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

    if (mainPkg && (create ||
        (mainPkg.getFiles().indexOf(constName) >= 0 && (rebuild || !fs.existsSync(constName))))) {
        pxt.log(`rebuilding ${constName} into ${constPath}...`)
        let files: string[] = []
        let foundConfig = false

        for (let d of mainPkg.sortedDeps()) {
            if (d.config.dalDTS) {
                if (d.config.dalDTS.includeDirs)
                    for (let dn of d.config.dalDTS.includeDirs) {
                        dn = buildEngine.buildPath + "/" + dn
                        if (U.endsWith(dn, ".h")) files.push(dn)
                        else {
                            let here = nodeutil.allFiles(dn, { maxDepth: 20 }).filter(fn => U.endsWith(fn, ".h"))
                            U.pushRange(files, here)
                        }
                    }
                excludeSyms = d.config.dalDTS.excludePrefix || excludeSyms
                foundConfig = true
            }
        }

        if (!foundConfig) {
            let incPath = buildEngine.buildPath + "/yotta_modules/microbit-dal/inc/"
            if (!fs.existsSync(incPath))
                incPath = buildEngine.buildPath + "/yotta_modules/codal/inc/";
            if (!fs.existsSync(incPath))
                incPath = buildEngine.buildPath
            if (!fs.existsSync(incPath))
                U.userError("cannot find " + incPath);
            files = nodeutil.allFiles(incPath, { maxDepth: 20 })
                .filter(fn => U.endsWith(fn, ".h"))
                .filter(fn => fn.indexOf("/mbed-classic/") < 0)
                .filter(fn => fn.indexOf("/mbed-os/") < 0)
        }

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
        // stabilize
        for (let fn of files) {
            extractConstants(fn, fc[fn])
        }

        let consts = "// Auto-generated. Do not edit.\ndeclare const enum DAL {\n"
        for (let fn of files) {
            let v = extractConstants(fn, fc[fn], true)
            if (v) {
                consts += "    // " + fn.replace(/\\/g, "/").replace(buildEngine.buildPath, "") + "\n"
                consts += v
            }
        }
        consts += "}\n"
        fs.writeFileSync(constPath, consts)
    }
}

const writeFileAsync: any = promisify(fs.writeFile)
const cpExecAsync = promisify(child_process.exec);
const readDirAsync = promisify(fs.readdir)

function buildFinalCsAsync(res: ts.pxtc.CompileResult) {
    return nodeutil.spawnAsync({
        cmd: getCSharpCommand(),
        args: ["-out:pxtapp.exe", "binary.cs"],
        cwd: "built",
    })
}

function getCSharpCommand() {
    return process.platform == "win32" ? "mcs.bat" : "mcs";
}

function msdDeployCoreAsync(res: ts.pxtc.CompileResult): Promise<void> {
    const firmwareName = [pxtc.BINARY_UF2, pxtc.BINARY_HEX, pxtc.BINARY_ELF].filter(f => !!res.outfiles[f])[0];
    if (!firmwareName) { // something went wrong heres
        pxt.reportError("compile", `firmware missing from built files (${Object.keys(res.outfiles).join(', ')})`)
        return Promise.resolve();
    }

    const firmware = res.outfiles[firmwareName];
    const encoding = firmwareName == pxtc.BINARY_HEX
        ? "utf8" : "base64";


    function copyDeployAsync() {
        return getBoardDrivesAsync()
            .then(drives => filterDrives(drives))
            .then(drives => {
                if (drives.length == 0)
                    throw new Error("cannot find any drives to deploy to");
                pxt.log(`copying ${firmwareName} to ` + drives.join(", "));
                const writeHexFile = (drivename: string) => {
                    return writeFileAsync(path.join(drivename, firmwareName), firmware, encoding)
                        .then(() => pxt.debug("   wrote to " + drivename))
                        .catch((e: Error) => {
                            throw new Error(`failed writing to ${drivename}; ${e.message}`);
                        })
                };
                return U.promiseMapAll(drives, d => writeHexFile(d))
                    .then(() => drives.length);
            }).then(() => { });
    }

    function hidDeployAsync() {
        const f = firmware
        const blocks = pxtc.UF2.parseFile(U.stringToUint8Array(atob(f)))
        return hid.initAsync()
            .then(dev => dev.flashAsync(blocks))
    }

    let p = Promise.resolve();
    if (pxt.appTarget.compile
        && pxt.appTarget.compile.useUF2
        && !pxt.appTarget.serial.noDeploy
        && hid.isInstalled(true)) {
        // try hid or simply bail out
        p = p.then(() => hidDeployAsync())
            .catch(e => copyDeployAsync());
    } else {
        p = p.then(() => copyDeployAsync())
    }
    return p;
}

function getBoardDrivesAsync(): Promise<string[]> {
    if (process.platform == "win32") {
        const rx = new RegExp("^([A-Z]:)\\s+(\\d+).* " + pxt.appTarget.compile.deployDrives)
        return cpExecAsync("wmic PATH Win32_LogicalDisk get DeviceID, VolumeName, FileSystem, DriveType")
            .then(({ stdout, stderr }) => {
                let res: string[] = [];
                stdout
                    .split(/\n/)
                    .forEach(ln => {
                        let m = rx.exec(ln);
                        if (m && m[2] == "2") {
                            res.push(m[1] + "/");
                        }
                    }
                    );
                return res;
            });
    }
    else if (process.platform == "darwin") {
        const rx = new RegExp(pxt.appTarget.compile.deployDrives)
        return readDirAsync("/Volumes")
            .then(lst => lst.filter(s => rx.test(s)).map(s => "/Volumes/" + s + "/"))
    } else if (process.platform == "linux") {
        const rx = new RegExp(pxt.appTarget.compile.deployDrives)
        const user = process.env["USER"]
        if (nodeutil.existsDirSync(`/media/${user}`))
            return readDirAsync(`/media/${user}`)
                .then(lst => lst.filter(s => rx.test(s)).map(s => `/media/${user}/${s}/`))
        return Promise.resolve([]);
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

interface CompileExtReq {
    config: string;
    tag: string;
    replaceFiles: pxt.Map<string>;
    dependencies?: pxt.Map<string>;
}

interface CompileServiceConfig {
    id: string;
    repourl?: string;
    binary?: string;
    target?: string;
    board?: string;
    image?: string; // docker image
    hexfile?: string;
    clone?: string;
    buildcmd?: string;
}

interface FileEntry {
    name: string;
    text: string;
}

interface CompileServiceResult {
    stdout: string;
    stderr: string;
    status: number | null;
    hexfile?: string
}

export async function compileWithLocalCompileService(extinfo: pxtc.ExtensionInfo): Promise<pxtc.HexInfo> {
    const resp = await runDockerCompileAsync(extinfo.compileData);

    if (resp.hexfile) {
        console.log("Compile successful");
    }
    else {
        console.log("Compile failed");
        console.log(resp.stderr)
        console.log(resp.stdout)
    }

    return resp.hexfile && {
        hex: resp.hexfile.split(/\r?\n/)
    };
}

async function runDockerCompileAsync(data: string) {
    const compileReq: CompileExtReq = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
    const deploymentConfig = JSON.parse(fs.readFileSync(path.resolve("../../../pxt-deployment-config/production/config.json"), "utf8"));

    const compileServiceConfig = (deploymentConfig.compileServices as CompileServiceConfig[]).find(cs => cs.id === compileReq.config);

    const isPlatformio = !!compileServiceConfig.board

    if (!(isPlatformio || compileServiceConfig.hexfile)) {
        const tag = compileReq.tag || ""

        if (compileServiceConfig.repourl) {
            if (/^[\w.\-]+$/.test(tag)) {
                compileServiceConfig.repourl = compileServiceConfig.repourl.replace(/#.*/g, "") + "#" + compileReq.tag;
            }
        }

        const moduleName = compileServiceConfig.binary.replace(/-combined/, "").replace(/\.hex$/, "");

        const modulejson = {
            "name": moduleName,
            "version": "0.0.0",
            "description": "Auto-generated. Do not edit.",
            "license": "n/a",
            "dependencies": compileReq.dependencies || {},
            "targetDependencies": {},
            "bin": "./source"
        };

        if (compileServiceConfig.repourl) {
            let repoSlug = compileServiceConfig.repourl.replace(/^https?:\/\/[^\/]+\//, "").replace(/\.git#/, "#")
            let pkgName = repoSlug.replace(/#.*/, "").replace(/^.*\//, "")
            modulejson.dependencies[pkgName] = repoSlug
        }

        compileReq.replaceFiles["/module.json"] = JSON.stringify(modulejson, null, 2) + "\n"
    }

    const mappedFiles: FileEntry[] = (
        Object.keys(compileReq.replaceFiles).map(
            filename => {
                return {
                    name: filename.replace(/^\/+/, ""),
                    text: compileReq.replaceFiles[filename]
                };
            }
        )
    );

    let image = compileServiceConfig.image
    if (!image) {
        if (isPlatformio) {
            image = "pext/platformio:latest";
        }
        else {
            image = "mcr.microsoft.com/makecode/yotta:main-gcc5";
        }
    }

    let hexFile = compileServiceConfig.hexfile;
    if (!hexFile && !isPlatformio) {
        hexFile = "source/" + compileServiceConfig.binary;
    }

    let gittag = "";

    if (compileServiceConfig.clone) {
        gittag = compileReq.tag;
    }
    else if (compileServiceConfig.repourl) {
        gittag = compileServiceConfig.repourl.replace(/.*#/, "");
    }

    const compileRequest = {
        op: "buildex",
        files: mappedFiles,
        gittag: gittag,
        empty: true,
        hexfile: hexFile,
        target: compileServiceConfig.target,
        platformio: isPlatformio,
        clone: compileServiceConfig.clone,
        buildcmd: compileServiceConfig.buildcmd,
        image: image,
        githubToken: process.env["GITHUB_ACCESS_TOKEN"]
    };

    const stdout = await nodeutil.spawnWithPipeAsync({
        cmd: "docker",
        args: ["run", "-i", "--env", "LOCAL_BUILD='TRUE'", pxt.appTarget.compileService.dockerImage],
        input: JSON.stringify(compileRequest)
    })

    const resp = JSON.parse(stdout.toString("utf8")) as CompileServiceResult;

    return resp;
}