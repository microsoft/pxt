/// <reference path="../typings/modules/request/index.d.ts"/>

"use strict";

import * as p from "./commandparser";
import * as fs from "fs";
import * as https from "https";
import * as nodeutil from "./nodeutil";
import * as path from "path";
import * as request from "request";
import * as url from "url";
import U = pxt.Util;

const npm = nodeutil.runNpmAsyncWithCwd;
const npmCmd = nodeutil.addCmd("npm");

let pxtElectronPath: string;
let pxtElectronSrcPath: string;
let targetProductJson: string;
let targetNpmPackageName: string;
let isInit = false;
let targetDir = process.cwd();
let outDir = path.join(targetDir, "electron-out");

interface GitHubAsset {
    name: string;
}

interface GitHubRelease {
    assets: GitHubAsset[];
    "upload_url": string;
}

interface GitHubCreateReleaseInfo {
    tag_name: string,
    name: string
}

function errorOut(msg: string): Promise<any> {
    console.error("ERROR: " + msg);
    process.exit(1)

    return Promise.resolve();
}

export function electronAsync(parsed: p.ParsedCommand): Promise<void> {
    // Ensure there is a subcommand
    const subcommand = parsed.arguments[0];

    if (!subcommand) {
        errorOut("Please specify a subcommand");
    }

    // Validate current target
    const needsCurrentTarget = subcommand !== "publish" && (subcommand !== "package" || !parsed.flags["release"]);

    if (needsCurrentTarget && (!fs.existsSync("pxtarget.json") || !fs.existsSync("package.json"))) {
        errorOut("This command requires to be in a valid target directory (pxtarget.json and package.json required)");
    }

    if (parsed.flags["release"]) {
        let match = /^(.*?)(?:@|$)/.exec(parsed.flags["release"] as string);

        if (!match || !match[1]) {
            errorOut("The specified released target is not valid. Required format: --release <target_npm_name>[@<target_npm_version>]");
        }

        targetNpmPackageName = match[1];
    } else {
        targetNpmPackageName = JSON.parse(fs.readFileSync("package.json", "utf8")).name;
    }

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
        setReleaseDirs();
    }

    // Invoke subcommand
    switch (subcommand) {
        case "init":
            return initAsync();
        case "run":
            return runAsync(parsed);
        case "package":
            return packageAsync(parsed);
        case "publish":
            return publishAsync(parsed);
        default:
            return errorOut("Unknown subcommand: " + subcommand);
    }
}

function setReleaseDirs(): void {
    targetDir = path.join(pxtElectronPath, "src", "node_modules", targetNpmPackageName);
    outDir = path.join(pxtElectronPath, "electron-out");
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

function publishAsync(parsed: p.ParsedCommand): Promise<void> {
    const builtRepoName = process.env["PXT_RELEASE_REPO_NAME"];
    const builtRepoOrg = process.env["PXT_RELEASE_REPO_ORG"];
    const accessToken = process.env["GITHUB_ACCESS_TOKEN"];
    const currentOs = process.platform;
    let builtRepoLocalPath: string;
    let latestTag: string;
    let releaseInfo: GitHubRelease;

    targetNpmPackageName = process.env["PXT_ELECTRON_TARGET"];

    if (!builtRepoName) {
        return errorOut("PXT_RELEASE_REPO_NAME not specified");
    }

    if (!builtRepoOrg) {
        return errorOut("PXT_RELEASE_REPO_ORG not specified");
    }

    if (!accessToken) {
        return errorOut("GITHUB_ACCESS_TOKEN not specified");
    }

    if (!targetNpmPackageName) {
        return errorOut("PXT_ELECTRON_TARGET not specified");
    }

    if (fs.existsSync(builtRepoName)) {
        builtRepoLocalPath = builtRepoName;
    } else {
        if (fs.existsSync(path.join("..", builtRepoName))) {
            builtRepoLocalPath = path.join("..", builtRepoName);
        }
    }

    if (!builtRepoLocalPath) {
        return errorOut("Release repo not cloned locally");
    }

    return nodeutil.gitInfoAsync(["--no-pager", "log", "--tags", "--simplify-by-decoration", "--pretty=\"format:%ai %d\""], builtRepoLocalPath, /*silent*/ true)
        .then((output) => {
            // Output is a list of tags sorted in reverse chronological order, example of a line: 2016-08-16 07:46:43 -0700  (tag: v0.3.30)
            const tagVersionRegex = /tag: (v\d+\.\d+\.\d+\.*?)[,\)]/;
            const execResult = tagVersionRegex.exec(output);

            if (!execResult) {
                return errorOut("Unable to determine latest tag of built repo");
            }

            latestTag = execResult[1];

            return getOrCreateGHRelease(builtRepoOrg, builtRepoName, accessToken, latestTag);
        })
        .then((r: GitHubRelease) => {
            releaseInfo = r;

            const appAlreadyExists = releaseInfo.assets.some((a) => {
                return a.name.indexOf(currentOs) !== -1;
            });

            if (appAlreadyExists) {
                console.log("Electron app already published for this version");
                return Promise.resolve();
            }

            parsed.flags["release"] = `${targetNpmPackageName}@${latestTag.substring(1)}`;
            parsed.flags["installer"] = true;
            setReleaseDirs();

            return packageAsync(parsed)
                .then(() => new Promise((resolve, reject) => {
                    let uploadAssetPath: string;

                    fs.readdirSync(outDir).forEach((p) => {
                        const itemPath = path.join(outDir, p);

                        if (!fs.statSync(itemPath).isDirectory() && itemPath.indexOf(currentOs) !== -1) {
                            uploadAssetPath = itemPath;
                        }
                    });

                    if (!uploadAssetPath) {
                        errorOut("Could not find asset to upload");
                    } else {
                        const req = request.post(`${releaseInfo["upload_url"].replace(/{\?name,label}/, "")}?name=${path.basename(uploadAssetPath)}&access_token=${accessToken}`, (err, resp, body) => {
                            if (err || resp.statusCode !== 201) {
                                errorOut("Error in POST request while uploading app to GitHub release");
                            } else {
                                resolve();
                            }
                        });
                        const form = req.form();

                        form.append(uploadAssetPath, fs.createReadStream(uploadAssetPath));
                    }
                }))
                .then(() => {
                    console.log("App successfully published to GitHub");
                });
        });
}

function getOrCreateGHRelease(builtRepoOrg: string, builtRepoName: string, accessToken: string, latestTag: string): Promise<GitHubRelease> {
    return U.httpGetJsonAsync(`https://api.github.com/repos/${builtRepoOrg}/${builtRepoName}/releases/tags/${latestTag}?access_token=${accessToken}`)
        .catch((e) => {
            const createRelease: GitHubCreateReleaseInfo = {
                tag_name: latestTag,
                name: latestTag
            };

            return U.requestAsync({
                method: "POST",
                url: `https://api.github.com/repos/${builtRepoOrg}/${builtRepoName}/releases?access_token=${accessToken}`,
                data: createRelease,
                allowHttpErrors: true
            })
                .then((resp) => {
                    if (resp.statusCode !== 201) {
                        return Promise.reject({ statusCode: resp.statusCode });
                    }

                    return Promise.resolve(resp.json);
                });
        })
        .catch((e) => {
            // Creating the release failed, error out
            return errorOut("Bad status while creating release: " + e.statusCode);
        });
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
            "--" + targetDir,
            "--" + outDir
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