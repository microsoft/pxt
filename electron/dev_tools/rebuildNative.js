/**
 * A script to rebuild native dependencies against the installed Electron version.
 */

"use strict";

let childProcess = require("child_process");
let electron = require("electron");
let electronRebuild = require("electron-rebuild");
let fs = require("fs");
let path = require("path");
let rimraf = require("rimraf");

// KEEP THIS UPDATED: Some modules need to have their built directory cleaned before rebuilding. Put any such known modules in this list.
let knownNativeModules = [
    {
        packageName: "serialport",
        cleanDir: path.join("build", "release")
    },
    {
        packageName: "keytar",
        cleanDir: path.join("build", "release")
    }
];
let targetDir = path.join(__dirname, "..", "src", "node_modules");

if (process.argv.length >= 3) {
    targetDir = process.argv[2];

    if (!/node_modules\/?$/.test(targetDir)) {
        targetDir = path.join(targetDir, "node_modules");
    }
}

let foldersToRebuild = [
    targetDir
];

function findFinalLinkTarget(p) {
    let foundFinal = false;
    let target = p;

    while (!foundFinal) {
        try {
            target = fs.readlinkSync(target);
        } catch (e) {
            foundFinal = true;
        }
    }

    return target;
}

function cleanKnownModulesRecursive(p) {
    knownNativeModules.forEach((nm) => {
        let fullPackagePath = path.join(p, nm.packageName);

        if (fs.existsSync(fullPackagePath)) {
            let fullBuildDir = path.join(fullPackagePath, nm.cleanDir);

            console.log(`    Cleaning ${fullBuildDir}`);
            rimraf.sync(fullBuildDir);
        }
    });

    let recurseFolders = [];

    fs.readdirSync(p).forEach((item) => {
        let fullDependencyPath = path.join(p, item);
        let nodeModulesPath = path.join(fullDependencyPath, "node_modules");

        if (fs.statSync(fullDependencyPath).isDirectory() && fs.existsSync(nodeModulesPath)) {
            recurseFolders.push(nodeModulesPath);
        }
    });

    recurseFolders.forEach((f) => {
        cleanKnownModulesRecursive(f);
    });
}

electronRebuild.shouldRebuildNativeModules(electron)
    .then((shouldBuild) => {
        if (!shouldBuild) {
            console.log("It doesn't look like you need to rebuild");
            return Promise.resolve();
        }

        console.log("Detecting linked modules (\"npm link\")...");
        fs.readdirSync(targetDir).forEach((m) => {
            let moduleRootPath = path.resolve(targetDir, m);
            let stat = fs.statSync(moduleRootPath);

            if (stat.isDirectory()) {
                let finalLink = path.resolve(findFinalLinkTarget(moduleRootPath));

                if (finalLink !== moduleRootPath) {
                    console.log(`    Detected npm link: ${m}`);
                    //foldersToRebuild.push(path.join(finalLink, "node_modules"));
                }
            }
        });

        console.log("Cleaning known native modules...");
        foldersToRebuild.forEach((f) => {
            cleanKnownModulesRecursive(f);
        });
        console.log("Rebuilding native modules...");

        let electronVersion = childProcess.execSync(`${electron} --version`, {
            encoding: "utf8",
        });
        electronVersion = electronVersion.match(/v(\d+\.\d+\.\d+)/)[1];

        let hadError = false;

        return foldersToRebuild.reduce((soFar, currentFolder) => {
            return soFar
                .then(() => {
                    console.log(`    ${currentFolder}`);
                    return electronRebuild.rebuildNativeModules(electronVersion, currentFolder);
                })
                .then(() => electronRebuild.preGypFixRun(currentFolder, true, electron))
                .catch((e) => {
                    hadError = true;
                    console.error(e);
                });
        }, electronRebuild.installNodeHeaders(electronVersion))
            .then(() => {
                if (hadError) {
                    throw new Error();
                }
            });
    })
    .then(() => {
        console.log("Done!")
    }, (e) => {
        console.error("Failed to rebuild some native modules:" + e);
    });
