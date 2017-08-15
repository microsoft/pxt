/// <reference path="../../localtypings/pxtcustomeditor.d.ts" />

import ext = pxt.extension;
import * as pkg from "./package";

enum Permissions {
    Serial,
    ReadUserCode
}

enum PermissionStatus {
    Granted,
    Denied,
    NotAvailable,
    NotYetPrompted
}

export class ExtensionHost {
    private statuses: pxt.Map<ext.Permissions<PermissionStatus>> = {};

    handleExtensionMessage(message: ext.Message) {
        switch (message.type) {
            case "request":
                this.handleRequestAsync(message as ext.Request);
                break;
            case "response":
            case "event":
                break;
        }
    }

    sendResponse(response: ext.Response) {
        // TODO
    }

    handleRequestAsync(request: ext.Request) {
        const resp = mkResponse(request);

        switch (request.subtype) {
            case "init":
                this.sendResponse(resp);
                break;
            case "datastream":
                return this.permissionOperation(request.id, Permissions.Serial, resp, handleDataStreamRequest);
            case "querypermission":
                const perm = this.getPermissions(request.id)
                const r = resp as ext.QueryPermissionResponse;
                r.body = statusesToResponses(perm);
                this.sendResponse(r);
                break;
            case "requestpermission":
                return this.requestPermissionsAsync(request.id, resp as ext.PermissionResponse, request.body);
            case "usercode":
                return this.permissionOperation(request.id, Permissions.ReadUserCode, resp, handleUserCodeRequest);
            case "readcode":
                handleReadCodeRequest(request.id, resp as ext.ReadCodeResponse);
                this.sendResponse(resp);
                break;
            case "writecode":
                handleWriteCodeRequest(request.id, resp, request.body);
                this.sendResponse(resp);
                break;

        }

        return Promise.resolve();
    }

    permissionOperation(id: string, permission: Permissions, resp: ext.Response, cb: (resp: ext.Response) => void) {
        return this.checkPermissionAsync(id, permission)
            .then(() => {
                cb(resp);
                this.sendResponse(resp);
            })
            .catch(() => {
                resp.success = false;
                resp.message = "permission denied";
                this.sendResponse(resp);
            });
    }

    getPermissions(id: string): ext.Permissions<PermissionStatus> {
        if (!this.statuses[id]) {
            this.statuses[id] = {
                serial: PermissionStatus.NotYetPrompted,
                readUserCode: PermissionStatus.NotYetPrompted
            };
        }
        return this.statuses[id]
    }

    checkPermissionAsync(id: string, permission: Permissions): Promise<boolean> {
        const perm = this.getPermissions(id)
        
        let status: PermissionStatus;
        switch (permission) {
            case Permissions.Serial: status = perm.serial; break;
            case Permissions.ReadUserCode: status = perm.readUserCode; break;
        }

        if (status === PermissionStatus.NotYetPrompted) {
            return this.promptForPermissionAsync(id, permission);
        }

        return Promise.resolve(status === PermissionStatus.Granted);
            
    }

    promptForPermissionAsync(id: string, permission: Permissions): Promise<boolean> {
        // TODO
        return Promise.resolve(false);
    }

    requestPermissionsAsync(id: string, resp: ext.PermissionResponse, p: ext.Permissions<boolean>) {
        const promises: Promise<boolean>[] = [];

        if (resp.body.readUserCode) {
            promises.push(this.checkPermissionAsync(id, Permissions.ReadUserCode));
        }
        if (resp.body.serial) {
            promises.push(this.checkPermissionAsync(id, Permissions.Serial));
        }

        return Promise.all(promises)
            .then(() => statusesToResponses(this.getPermissions(id)));
    }
}

function handleUserCodeRequest(resp: ext.Response) {
    const mainPackage = pkg.mainEditorPkg() as pkg.EditorPackage;
    resp.body = mainPackage.getAllFiles();
}

function handleDataStreamRequest(resp: ext.Response) {
    // TODO
}

function handleReadCodeRequest(id: string, resp: ext.ReadCodeResponse) {
    const mainPackage = pkg.mainEditorPkg() as pkg.EditorPackage;
    const extPackage = mainPackage.pkgAndDeps().filter(p => p.getPkgId() === id)[0];
    if (extPackage) {
        const files = extPackage.getAllFiles();
        resp.body = {
            json: files["extension.json"],
            code: files["extension.ts"]
        };
    }
    else {
        resp.success = false;
        resp.message = "could not find package";
    }
}

function handleWriteCodeRequest(id: string, resp: ext.Response, files: ext.ExtensionFiles) {
    const mainPackage = pkg.mainEditorPkg() as pkg.EditorPackage;
    const extPackage = mainPackage.pkgAndDeps().filter(p => p.getPkgId() === id)[0];
    if (extPackage) {
        if (files.json !== undefined) {
            extPackage.setFile("extension.json", files.json);
        }
        if (files.code !== undefined) {
            extPackage.setFile("extension.ts", files.code);
        }
    }
    else {
        resp.success = false;
        resp.message = "could not find package";
    }
}

function mkEvent(event: string): ext.Event {
    return {
        type: "event",
        event
    };
}

function mkResponse(request: ext.Request, success = true): ext.Response {
    return {
        type: "response",
        id: request.id,
        subtype: request.subtype,
        requestSeq: request.seq,
        success
    };
}

function statusesToResponses(perm: ext.Permissions<PermissionStatus>): ext.Permissions<ext.PermissionResponses> {
    return {
        readUserCode: statusToResponse(perm.readUserCode),
        serial: statusToResponse(perm.serial)
    };
}

function statusToResponse(p: PermissionStatus): ext.PermissionResponses {
    switch (p) {
        case PermissionStatus.NotYetPrompted:
        case PermissionStatus.Denied:
            return ext.PermissionResponses.Denied;
        case PermissionStatus.Granted:
            return ext.PermissionResponses.Granted;
        case PermissionStatus.NotAvailable:
            return ext.PermissionResponses.NotAvailable;
    }
}