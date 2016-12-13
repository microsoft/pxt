"use strict";

import * as p from "./commandparser";
import * as fs from "fs";
import * as nodeutil from './nodeutil';
import * as path from "path";

const gulpCmd = process.platform === "win32" ? "gulp.cmd" : "gulp";
const nodeCmd = process.platform === "win32" ? "node.cmd" : "node";
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

let pxtElectronPath: string;
let pxtElectronSrcPath: string;
let targetProductJson: string;
let targetId: string;
let isInit = false;
let buildOut: string;

function errorOut(msg: string): Promise<void> {
    console.error(msg);
    process.exit(1)

    return null;
}

export function electronAsync(parsed: p.ParsedCommand): Promise<void> {
    // Ensure there is a subcommand
    let subcommand = parsed.arguments[0];

    if (!subcommand) {
        errorOut("Please specify a subcommand");
    }

    // Validate current target
    let needsCurrentTarget = (subcommand !== "build" && subcommand !== "dist") || !parsed.flags["release"];

    if (needsCurrentTarget && !fs.existsSync("pxtarget.json") && !fs.existsSync("package.json")) {
        errorOut("This command requires to be in a valid target directory (pxtarget.json and package.json required)");
    }

    targetId = JSON.parse(fs.readFileSync("package.json", "utf8")).name;

    // Find root of PXT Electron app sources
    if (parsed.flags["pxtElectron"]) {
        pxtElectronPath = parsed.flags["pxtElectron"] as string;

        if (!fs.existsSync(pxtElectronPath)) {
            errorOut("Cannot find the specified PXT Electron app: " + pxtElectronPath);
        }
    } else {
        pxtElectronPath = path.join("..", "pxt", "electron");

        if (!fs.existsSync(pxtElectronPath)) {
            errorOut("Please specify --pxtElectron path; cannot find PXT Electron at default location: " + pxtElectronPath);
        }
    }

    pxtElectronPath = path.resolve(pxtElectronPath);
    pxtElectronSrcPath = path.resolve(pxtElectronPath, "src");

    // Ensure there is a product.json
    if (parsed.flags["product"]) {
        targetProductJson = parsed.flags["product"] as string;

        if (!fs.existsSync(targetProductJson)) {
            errorOut("Cannot find the specified product.json file: " + targetProductJson);
        }
    } else {
        targetProductJson = path.join("electron", "product.json");

        if (!fs.existsSync(targetProductJson)) {
            errorOut("Please specify --product path; cannot find product.json at default location: " + targetProductJson);
        }
    }

    targetProductJson = path.resolve(targetProductJson);

    // Other initializations
    let linkedTarget = path.join(pxtElectronSrcPath, "node_modules", targetId);
    let linkPath = fs.existsSync(linkedTarget) ? finalLinkPath(linkedTarget) : null;

    isInit = path.resolve(linkPath) === path.resolve(process.cwd());

    if (parsed.flags["release"]) {
        buildOut = "out";
    } else {
        buildOut = path.join(process.cwd(), "electron-out");
    }

    // Invoke subcommand
    switch (subcommand) {
        case "init":
            return initAsync();
        case "run":
            return runAsync();
        case "build":
            return buildAsync(parsed);
        case "dist":
            return distAsync();
        default:
            return errorOut("Unknown subcommand: " + subcommand);
    }
}

function initAsync(): Promise<void> {
    return npmVersion()
        .then((v) => {
            if (/^3\./.test(v)) {
                return errorOut("'pxt electron init/run' is not supported in NPM 3+ due to a package linking bug. You can still use 'pxt electron build', however.");
            }

            return npmInstall(pxtElectronPath);
        })
        .then(() => npmLink(pxtElectronSrcPath, process.cwd()))
        .then(() => npmRunElectronScript("rebuild-native"))
        .then(() => console.log("\nWARNING: 'pxt electron init/run' can conflict with 'pxt serve'. If you have problems with 'pxt serve', delete all node modules and reinstall them (for both the target and pxt-core)."));
}

function runAsync(): Promise<void> {
    if (!isInit) {
        return errorOut("Current target not linked in Electron app; did you run 'pxt electron init'?");
    }

    return electronGulpTask("compile")
        .then(() => npmRunElectronScript("start"));
}

function buildAsync(parsed: p.ParsedCommand): Promise<void> {
    let buildPromise = npmPrune(pxtElectronSrcPath);

    if (parsed.flags["release"]) {
        buildPromise = buildPromise.then(() => npmInstall(pxtElectronSrcPath, parsed.flags["release"] as string));
    } else {
        buildPromise = buildPromise.then(() => installLocalTargetAsync());
    }

    return buildPromise
        .then(() => npmInstall(pxtElectronPath))
        .then(() => npmRunElectronScript("rebuild-native"))
        .then(() => electronGulpTask("package"));
}

function distAsync(): Promise<void> {
    return electronGulpTask("dist");
}

function installLocalTargetAsync(): Promise<void> {
    return npmInstall(pxtElectronSrcPath, process.cwd())
        .then(() => {
            // If pxt-core is linked inside the current target, install the linked pxt-core in the app instead of the published one
            let pxtCorePath = path.join(process.cwd(), "node_modules", "pxt-core");
            let pxtCoreTruePath = finalLinkPath(pxtCorePath);

            if (pxtCorePath !== pxtCoreTruePath) {
                return reinstallLocalPxtCoreAsync(pxtCoreTruePath);
            }

            return Promise.resolve();
        });
}

function reinstallLocalPxtCoreAsync(pxtCoreTruePath: string): Promise<void> {
    // The location where we need to run npm install for pxt-core depends on NPM 2 vs NPM 3, so we first launch a small node script to determine where it was installed
    let pxtCoreLocation: string;

    return nodeutil.spawnWithPipeAsync({
        cmd: nodeCmd,
        args: [
            "-e",
            `console.log(require(${targetId}).pxtCoreDir)`
        ],
        cwd: pxtElectronSrcPath
    })
        .then((pxtCoreLocationBuffer) => {
            pxtCoreLocation = path.join(pxtCoreLocationBuffer.toString(), "..", "..");

            return npmUninstall(pxtCoreLocation, "pxt-core");
        })
        .then(() => npmInstall(pxtCoreLocation, pxtCoreTruePath));
}

function electronGulpTask(taskName: string): Promise<void> {
    return nodeutil.spawnAsync({
        cmd: gulpCmd,
        args: [
            taskName,
            "--" + targetProductJson,
            "--" + buildOut
        ],
        cwd: pxtElectronPath
    });
}

function npmVersion(): Promise<string> {
    return nodeutil.spawnWithPipeAsync({
        cmd: npmCmd,
        "args": ["-v"]
    })
        .then((buf) => {
            return buf.toString();
        });
}

function npmLink(cwd: string, moduleToLink: string): Promise<void> {
    return nodeutil.spawnAsync({
        cmd: npmCmd,
        args: [
            "link",
            moduleToLink],
        cwd
    });
}

function npmInstall(cwd: string, npmPackage?: string): Promise<void> {
    let args = ["install"];

    if (npmPackage) {
        args.push(npmPackage);
    }

    return nodeutil.spawnAsync({
        cmd: npmCmd,
        args,
        cwd
    });
}

function npmUninstall(cwd: string, npmPackage: string): Promise<void> {
    return nodeutil.spawnAsync({
        cmd: npmCmd,
        args: [
            "uninstall",
            npmPackage
        ],
        cwd
    });
}

function npmPrune(cwd: string): Promise<void> {
    return nodeutil.spawnAsync({
        cmd: npmCmd,
        args: ["prune"],
        cwd
    });
}

function npmRunElectronScript(script: string, scriptArgs?: string[]): Promise<void> {
    let args = [
        "run",
        script
    ];

    if (scriptArgs) {
        args.push("--");
        args = args.concat(scriptArgs);
    }

    return nodeutil.spawnAsync({
        cmd: npmCmd,
        args,
        cwd: pxtElectronPath
    });
}

function finalLinkPath(link: string): string {
    let foundFinal = false;
    let target = link;

    while (!foundFinal) {
        try {
            target = fs.readlinkSync(target);
        } catch (e) {
            foundFinal = true;
        }
    }

    return target;
}