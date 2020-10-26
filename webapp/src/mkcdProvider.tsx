import * as React from "react";
import * as sui from "./sui";
import * as core from "./core";
import * as auth from "./auth";
import * as data from "./data";
import * as codecard from "./codecard";
import * as cloudsync from "./cloudsync";

// TODO: We need to do auth and cloud sync through this class.

export class Provider extends cloudsync.ProviderBase implements cloudsync.Provider {

    constructor() {
        super("mkcd", lf("MakeCode"), "xicon makecode", "https://www.makecode.com");
    }

    listAsync(): Promise<cloudsync.FileInfo[]> {
        throw new Error("Method not implemented.");
    }
    downloadAsync(id: string): Promise<cloudsync.FileInfo> {
        throw new Error("Method not implemented.");
    }
    uploadAsync(id: string, baseVersion: string, files: pxt.Map<string>): Promise<cloudsync.FileInfo> {
        throw new Error("Method not implemented.");
    }
    deleteAsync(id: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    updateAsync(id: string, newName: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    getUserInfoAsync(): Promise<pxt.editor.UserInfo> {
        throw new Error("Method not implemented.");
    }
}
