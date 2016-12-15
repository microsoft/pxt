"use strict";

import { autoUpdater } from "electron";
import { EventEmitter } from "events";
import * as I from "../typings/interfaces";

export class OsxUpdater extends EventEmitter implements I.UpdaterBase {
    constructor() {
        super();
    }

    public setFeedURL(url: string): void {
        autoUpdater.setFeedURL(url);
    }

    public checkForUpdates(): void {
        autoUpdater.checkForUpdates();
    }

    public quitAndInstall(): void {
        autoUpdater.quitAndInstall();
    }

    public addListener(event: string | symbol, listener: Function): this {
        autoUpdater.addListener(event, listener);
        return this;
    }
}
