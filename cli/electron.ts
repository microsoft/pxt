"use strict";

import * as p from "./commandparser";
import * as fs from "fs";
import * as nodeutil from './nodeutil';
import * as path from "path";

const npm = nodeutil.runNpmAsyncWithCwd;
const npmCmd = nodeutil.addCmd("npm");

let pxtElectronPath: string;
let pxtElectronSrcPath: string;
let targetProductJson: string;
let targetNpmPackageName: string;
let isInit = false;
let targetDir = process.cwd();

function errorOut(msg: string): Promise<void> {
    console.error(msg);
    process.exit(1)

    return null;
}

export function electronAsync(parsed: p.ParsedCommand): Promise<void> {
    // Ensure there is a subcommand
    const subcommand = parsed.arguments[0];

    if (!subcommand) {
        errorOut("Please specify a subcommand");
    }

    // Validate current target
    const needsCurrentTarget = subcommand !== "package" || !parsed.flags["release"];

    if (needsCurrentTarget && (!fs.existsSync("pxtarget.json") || !fs.existsSync("package.json"))) {
        errorOut("This command requires to be in a valid target directory (pxtarget.json and package.json required)");
    }

    targetNpmPackageName = JSON.parse(fs.readFileSync("package.json", "utf8")).name;

    // Find root of PXT Electron app sources
    if (parsed.flags["appsrc"]) {
        pxtElectronPath = parsed.flags["appsrc"] as string;

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
    if (subcommand !== "init") {
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
    }

    // Other initializations
    const linkedTarget = path.join(pxtElectronSrcPath, "node_modules", targetNpmPackageName);
    const linkPath = fs.existsSync(linkedTarget) ? finalLinkPath(linkedTarget) : null;

    isInit = linkPath && path.resolve(linkPath) === path.resolve(process.cwd());

    if (parsed.flags["release"]) {
        targetDir = pxtElectronPath;
    }

    // Invoke subcommand
    switch (subcommand) {
        case "init":
            return initAsync();
        case "run":
            return runAsync(parsed);
        case "package":
            return packageAsync(parsed);
        default:
            return errorOut("Unknown subcommand: " + subcommand);
    }
}

function initAsync(): Promise<void> {
    return npm(pxtElectronSrcPath, "prune")
        .then(() => nodeutil.spawnWithPipeAsync({
            cmd: npmCmd,
            "args": ["-v"]
        }))
        .then((buf) => buf.toString())
        .then((v) => {
            if (/^3\./.test(v)) {
                return errorOut("'pxt electron init/run' only works in NPM 2 due to a package linking bug in NPM 3. You can still use 'pxt electron package', however.");
            }

            return npm(pxtElectronPath, "install");
        })
        .then(() => npm(pxtElectronSrcPath, "link", process.cwd()))
        .then(() => npm(pxtElectronPath, "run", "rebuildnative"))
        .then(() => console.log("\nWARNING: 'pxt electron init' can break 'pxt serve'. If you have problems with 'pxt serve', delete all node modules and reinstall them (for both the target and pxt-core)."));
}

function runAsync(parsed: p.ParsedCommand): Promise<void> {
    if (!isInit) {
        return errorOut("Current target not linked in Electron app; did you run 'pxt electron init'?");
    }

    let compilePromise = Promise.resolve();

    if (!parsed.flags["just"]) {
        compilePromise = compilePromise.then(() => electronGulpTask("compile"));
    }

    return compilePromise
        .then(() => npm(pxtElectronPath, "run", "start"));
}

function packageAsync(parsed: p.ParsedCommand): Promise<void> {
    let installPromise = Promise.resolve();

    if (!parsed.flags["just"]) {
        installPromise = installPromise.then(() => npm(pxtElectronSrcPath, "prune"));

        if (parsed.flags["release"]) {
            installPromise = installPromise.then(() => npm(pxtElectronSrcPath, "install", parsed.flags["release"] as string));
        } else {
            installPromise = installPromise.then(() => installLocalTargetAsync());
        }

        installPromise = installPromise
            .then(() => npm(pxtElectronPath, "install"))
            .then(() => npm(pxtElectronPath, "run", "rebuildnative"));
    }

    return installPromise
        .then(() => electronGulpTask("package"))
        .then(() => {
            if (parsed.flags["installer"]) {
                return buildInstallerAsync();
            }

            return Promise.resolve();
        });
}

function buildInstallerAsync(): Promise<void> {
    return electronGulpTask("dist");
}

function installLocalTargetAsync(): Promise<void> {
    return npm(pxtElectronSrcPath, "install", process.cwd())
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
    // The location where we need to run npm install for pxt-core depends on NPM 2 vs NPM 3, so we first launch a small node script to determine where to install from
    let pxtCoreLocation: string;

    return nodeutil.spawnWithPipeAsync({
        cmd: "node",
        args: [
            "-e",
            `console.log(require("${targetNpmPackageName}").pxtCoreDir)`
        ],
        cwd: pxtElectronSrcPath
    })
        .then((pxtCoreLocationBuffer) => {
            pxtCoreLocation = path.join(pxtCoreLocationBuffer.toString(), "..", "..");

            return npm(pxtCoreLocation, "uninstall", "pxt-core");
        })
        .then(() => npm(pxtCoreLocation, "install", pxtCoreTruePath));
}

function electronGulpTask(taskName: string): Promise<void> {
    const gulpPath = path.join(pxtElectronPath, "node_modules", ".bin", "gulp");

    return nodeutil.spawnAsync({
        cmd: nodeutil.addCmd(gulpPath),
        args: [
            taskName,
            "--" + targetProductJson,
            "--" + targetDir
        ],
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