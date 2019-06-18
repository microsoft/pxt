import e = pxt.editor;
import * as pkg from "./package";

export enum Permissions {
    Console,
    ReadUserCode
}

export enum PermissionStatus {
    Granted,
    Denied,
    NotAvailable,
    NotYetPrompted
}

export interface ExtensionHost {
    send(name: string, message: e.ExtensionMessage): void;
    promptForPermissionAsync(name: string, permission: Permissions[]): Promise<boolean>;
}

export interface PermissionRequest {
    extId: string;
    permissions: Permissions[];
    resolver: (choice: boolean) => void;
}

export class ExtensionManager {
    private statuses: pxt.Map<e.Permissions<PermissionStatus>> = {};
    private nameToExtId: pxt.Map<string> = {};
    private extIdToName: pxt.Map<string> = {};
    private consent: pxt.Map<boolean> = {};

    private pendingRequests: PermissionRequest[] = [];
    private queueLock = false;

    // name to enabled
    private streams: pxt.Map<boolean> = {};

    constructor(private host: ExtensionHost) {
    }

    streamingExtensions(): string[] {
        return Object.keys(this.streams);
    }

    handleExtensionMessage(message: e.ExtensionMessage) {
        this.handleRequestAsync(message as e.ExtensionRequest)
            .catch(e => { })
    }

    sendEvent(extId: string, event: string) {
        this.host.send(extId, mkEvent(event));
    }

    setConsent(extId: string, allowed: boolean) {
        this.consent[extId] = allowed;
    }

    hasConsent(extId: string) {
        return this.consent[extId];
    }

    getExtId(name: string): string {
        if (!this.nameToExtId[name]) {
            this.nameToExtId[name] = ts.pxtc.Util.guidGen();
            this.extIdToName[this.nameToExtId[name]] = name;
        }
        return this.nameToExtId[name];
    }

    private sendResponse(response: e.ExtensionResponse) {
        this.host.send(this.extIdToName[response.extId], response);
    }

    private handleRequestAsync(request: e.ExtensionRequest): Promise<void> {
        const resp = mkResponse(request);

        if (!this.hasConsent(request.extId)) {
            resp.success = false;
            resp.error = ""
            this.sendResponse(resp);
            return Promise.reject("No consent");
        }

        switch (request.action) {
            case "extinit":
                const ri = resp as pxt.editor.InitializeResponse;
                ri.target = pxt.appTarget;
                this.sendResponse(resp);
                break;
            case "extdatastream":
                return this.permissionOperation(request.extId, Permissions.Console, resp, (name, resp) => this.handleDataStreamRequest(name, resp));
            case "extquerypermission":
                const perm = this.getPermissions(request.extId)
                const r = resp as e.ExtensionResponse;
                r.resp = statusesToResponses(perm);
                this.sendResponse(r);
                break;
            case "extrequestpermission":
                return this.requestPermissionsAsync(request.extId, resp as e.PermissionResponse, request.body);
            case "extusercode":
                return this.permissionOperation(request.extId, Permissions.ReadUserCode, resp, handleUserCodeRequest);
            case "extreadcode":
                handleReadCodeRequest(this.extIdToName[request.extId], resp as e.ReadCodeResponse);
                this.sendResponse(resp);
                break;
            case "extwritecode":
                handleWriteCodeRequestAsync(this.extIdToName[request.extId], resp, request.body)
                    .done(() => this.sendResponse(resp));
                break;
        }

        return Promise.resolve();
    }

    private permissionOperation(id: string, permission: Permissions, resp: e.ExtensionResponse, cb: (name: string, resp: e.ExtensionResponse) => void) {
        return this.checkPermissionAsync(id, permission)
            .then(hasPermission => {
                if (hasPermission) {
                    cb(this.extIdToName[id], resp);
                    this.sendResponse(resp);
                }
                else {
                    resp.success = false;
                    resp.error = "permission denied";
                    this.sendResponse(resp);
                }
            })
            .catch(e => {
                resp.success = false;
                resp.error = e;
                this.sendResponse(resp);
            });
    }

    private getPermissions(id: string): e.Permissions<PermissionStatus> {
        if (!this.statuses[id]) {
            this.statuses[id] = {
                console: PermissionStatus.NotYetPrompted,
                readUserCode: PermissionStatus.NotYetPrompted
            };
        }
        return this.statuses[id]
    }

    private queuePermissionRequest(extId: string, permission: Permissions): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            const req: PermissionRequest = {
                extId,
                permissions: [permission],
                resolver: resolve
            };

            this.pendingRequests.push(req);
            if (!this.queueLock && this.pendingRequests.length === 1) {
                this.queueLock = true;
                this.nextPermissionRequest();
            }
        });
    }

    private nextPermissionRequest() {
        if (this.pendingRequests.length) {
            const current = this.pendingRequests.shift();

            // Don't allow duplicate requests to prevent spamming
            current.permissions = current.permissions.filter(p => this.hasNotBeenPrompted(current.extId, p))

            if (current.permissions.length) {
                this.host.promptForPermissionAsync(this.extIdToName[current.extId], current.permissions)
                    .done(approved => {
                        current.resolver(approved);
                        this.nextPermissionRequest();
                    })
            }
            else {
                this.nextPermissionRequest();
            }
        }
        else {
            this.queueLock = false;
        }
    }

    private checkPermissionAsync(id: string, permission: Permissions): Promise<boolean> {
        const perm = this.getPermissions(id)

        let status: PermissionStatus;
        switch (permission) {
            case Permissions.Console: status = perm.console; break;
            case Permissions.ReadUserCode: status = perm.readUserCode; break;
        }

        if (status === PermissionStatus.NotYetPrompted) {
            return this.queuePermissionRequest(id, permission)
                .then(approved => {
                    const newStatus = approved ? PermissionStatus.Granted : PermissionStatus.Denied;
                    switch (permission) {
                        case Permissions.Console:
                            this.statuses[id].console = newStatus; break;
                        case Permissions.ReadUserCode:
                            this.statuses[id].readUserCode = newStatus; break;
                    }
                    return approved;
                });
        }

        return Promise.resolve(status === PermissionStatus.Granted);

    }

    private requestPermissionsAsync(id: string, resp: e.PermissionResponse, p: e.Permissions<boolean>) {
        const promises: Promise<boolean>[] = [];

        if (p.readUserCode) {
            promises.push(this.checkPermissionAsync(id, Permissions.ReadUserCode));
        }
        if (p.console) {
            promises.push(this.checkPermissionAsync(id, Permissions.Console));
        }

        return Promise.all(promises)
            .then(() => statusesToResponses(this.getPermissions(id)))
            .then(responses => { resp.resp = responses });
    }

    hasNotBeenPrompted(extId: string, permission: Permissions) {
        const perm = this.getPermissions(extId);
        let status: PermissionStatus;
        switch (permission) {
            case Permissions.Console: status = perm.console; break;
            case Permissions.ReadUserCode: status = perm.readUserCode; break;
        }
        return status === PermissionStatus.NotYetPrompted;
    }

    private handleDataStreamRequest(name: string, resp: e.ExtensionResponse) {
        // ASSERT: permission has been granted
        this.streams[name] = true;
    }
}

function handleUserCodeRequest(name: string, resp: e.ExtensionResponse) {
    // ASSERT: permission has been granded
    const mainPackage = pkg.mainEditorPkg() as pkg.EditorPackage;
    resp.resp = mainPackage.getAllFiles();
}

function handleReadCodeRequest(name: string, resp: e.ReadCodeResponse) {
    const mainPackage = pkg.mainEditorPkg() as pkg.EditorPackage;
    const fn = ts.pxtc.escapeIdentifier(name);
    const files = mainPackage.getAllFiles();
    resp.resp = {
        json: files[fn + ".json"],
        code: files[fn + ".ts"],
        jres: files[fn + ".jres"],
        asm: files[fn + ".asm"]
    };
}

function handleWriteCodeRequestAsync(name: string, resp: e.ExtensionResponse, files: e.ExtensionFiles) {
    const mainPackage = pkg.mainEditorPkg() as pkg.EditorPackage;
    const fn = ts.pxtc.escapeIdentifier(name);

    function shouldUpdate(value: string, ext: string): boolean {
        return value !== undefined && (!mainPackage.files[fn + ext] || mainPackage.files[fn + ext].content != value);
    }

    let needsUpdate = false;
    if (shouldUpdate(files.json, ".json")) {
        needsUpdate = true;
        mainPackage.setFile(fn + ".json", files.json);
    }
    if (shouldUpdate(files.code, ".ts")) {
        needsUpdate = true;
        mainPackage.setFile(fn + ".ts", files.code);
    }
    if (shouldUpdate(files.jres, ".jres")) {
        needsUpdate = true;
        mainPackage.setFile(fn + ".jres", files.jres);
    }
    if (shouldUpdate(files.asm, ".asm")) {
        needsUpdate = true;
        mainPackage.setFile(fn + ".asm", files.asm);
    }

    return !needsUpdate ? Promise.resolve() : mainPackage.updateConfigAsync(cfg => {
        if (files.json !== undefined && cfg.files.indexOf(fn + ".json") < 0) {
            cfg.files.push(fn + ".json")
        }
        if (files.code !== undefined && cfg.files.indexOf(fn + ".ts") < 0) {
            cfg.files.push(fn + ".ts")
        }
        if (files.jres !== undefined && cfg.files.indexOf(fn + ".jres") < 0) {
            cfg.files.push(fn + ".jres")
        }
        if (files.asm !== undefined && cfg.files.indexOf(fn + ".asm") < 0) {
            cfg.files.push(fn + ".asm");
        }
        return mainPackage.savePkgAsync();
    });
}

function mkEvent(event: string): e.ExtensionEvent {
    return {
        target: pxt.appTarget.id,
        type: "pxtpkgext",
        event
    };
}

function mkResponse(request: e.ExtensionRequest, success = true): e.ExtensionResponse {
    return {
        type: "pxtpkgext",
        id: request.id,
        extId: request.extId,
        success
    };
}

function statusesToResponses(perm: e.Permissions<PermissionStatus>): e.Permissions<e.PermissionResponses> {
    return {
        readUserCode: statusToResponse(perm.readUserCode),
        console: statusToResponse(perm.console)
    };
}

function statusToResponse(p: PermissionStatus): e.PermissionResponses {
    switch (p) {
        case PermissionStatus.NotYetPrompted:
        case PermissionStatus.Denied:
            return e.PermissionResponses.Denied;
        case PermissionStatus.Granted:
            return e.PermissionResponses.Granted;
        case PermissionStatus.NotAvailable:
        default:
            return e.PermissionResponses.NotAvailable;
    }
}