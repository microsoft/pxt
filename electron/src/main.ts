/// <reference path="typings/windows-mutex.d.ts" />

"use strict";

import * as Promise from "bluebird";
import { app, BrowserWindow, dialog, Menu } from "electron";
import * as I from "./typings/interfaces";
import * as minimist from "minimist";
import * as path from "path";
import product from "./util/productInfoLoader";
import { UpdateService } from "./updater/updateService";
import { Mutex } from 'windows-mutex';

const target = require(product.targetId);
let pxtCore: I.PxtCore = target.pxtCore;

// require.resolve() gives path to [target dir]/built/pxtrequire.js, so move up twice to get target root dir
const targetDir = path.resolve(require.resolve(product.targetId), "..", "..");

let appOptions: I.AppOptions = {};
let win: Electron.BrowserWindow = null;
let windowsMutex: Mutex = null;
let updateService: UpdateService = null;
let messagingDelay = Promise.delay(5000);

function parseArgs() {
    let opts: minimist.Opts = {
        alias: {
            a: "debug-webapp",
            n: "npm-start",
            w: "debug-webview"
        },
        boolean: ["debug-webapp", "npm-start", "debug-webview"]
    };

    const parsedArgs = minimist(process.argv.slice(1), opts);

    if (parsedArgs.hasOwnProperty("a")) {
        appOptions.debugWebapp = parsedArgs["a"];
    }

    if (parsedArgs.hasOwnProperty("n")) {
        appOptions.isNpmStart = parsedArgs["n"];
    }

    if (parsedArgs.hasOwnProperty("w")) {
        appOptions.debugWebview = parsedArgs["w"];
    }
}

function fixCwd(): void {
    if (appOptions.isNpmStart) {
        return;
    }

    // At this point, we are not in a directory that is the root of the app, so we need to change cwd
    let appPath = app.getAppPath();

    if (appPath !== process.cwd()) {
        console.log("Changing current working directory to " + appPath);
        process.chdir(appPath);
    }
}

function isUpdateEnabled() {
    return !!product.releaseManifestUrl && !!product.updateDownloadUrl;
}

function createPxtHandlers(): I.Map<I.ElectronHandler> {
    let handlers: I.Map<I.ElectronHandler> = {};

    if (isUpdateEnabled()) {
        handlers["check-for-update"] = () => {
            if (!updateService) {
                pxtCore.sendElectronMessage({ type: "update-check-error" });
            } else {
                updateService.checkForUpdate();
            }
        };
        handlers["update"] = (args: I.UpdateEventInfo) => {
            if (!updateService) {
                pxtCore.sendElectronMessage({ type: "update-download-error" });
            } else {
                updateService.update(args.targetVersion, args.isCritical);
            }
        };
    }

    handlers["quit"] = () => {
        app.quit();
    };

    return handlers;
}

function registerUpdateHandlers(): void {
    let events = [
        "critical-update",
        "update-available",
        "update-not-available",
        "update-check-error",
        "update-download-error"
    ];

    events.forEach((e) => {
        updateService.on(e, (args?: any) => {
            messagingDelay.then(() => {
                pxtCore.sendElectronMessage({
                    type: e,
                    args
                });
            });
        });
    });
}

function main(): void {
    parseArgs();
    fixCwd();

    if (process.platform === "win32") {
        try {
            const Mutex = require("windows-mutex").Mutex;
            windowsMutex = new Mutex(product.win32MutexName);
        } catch (e) {
            // Continue normally, but user might need to manually close app in case of update
        }
    }

    pxtCore.mainCli(targetDir, ["serve", "--no-browser", "--electron"], createPxtHandlers())
        .then(() => {
            createWindow();

            if (isUpdateEnabled()) {
                updateService = new UpdateService();
                registerUpdateHandlers();
                updateService.start()
                    .then(() => {
                        return updateService.versionCheck();
                    })
                    .catch((e) => {
                        // Error creating the update server; silently swallow, but updates won't work for this session
                        updateService = null;
                    });
            }
        });
}

function createWindow(): void {
    let url = `file://${__dirname}/webview/index.html`;

    win = new BrowserWindow({
        width: 800,
        height: 600,
        title: product.nameLong
    });
    Menu.setApplicationMenu(null);
    win.loadURL(url);
    win.on('closed', () => {
        win = null;
    });
    win.webContents.on("did-stop-loading", () => {
        if (appOptions.debugWebview) {
            win.webContents.openDevTools({ mode: "detach" });
        }

        let loadWebappMessage: I.WebviewStartMessage = {
            devtools: appOptions.debugWebapp,
            localtoken: pxtCore.globalConfig.localToken
        };

        win.webContents.send("start", loadWebappMessage);
    });
}

function dispose() {
    if (windowsMutex) {
        windowsMutex.release();
    }
}

app.on('ready', () => {
    main();
});
app.on('window-all-closed', () => {
    // TODO: For OSX, keep the app alive when windows are closed. For this, pxt-core needs to expose a way to shut down the local server.
    /*if (process.platform !== 'darwin') {
        app.quit();
    }*/
    app.quit();
});
app.on('will-quit', () => {
    dispose();
});

// TODO: For OSX, keep the app alive when windows are closed. For this, pxt-core needs to expose a way to shut down the local server.
/*app.on('activate', () => {
    if (win === null) {
        createWindow();
    }
});*/
