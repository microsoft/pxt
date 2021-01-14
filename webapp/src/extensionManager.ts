import e = pxt.editor;
import * as pkg from "./package";

export enum Permissions {
    Console,
    ReadUserCode,
    AddDependencies,
    // This permission is only available for trusted extensions
    Messages
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
    private consent: pxt.Map<boolean> = {}

    private pendingRequests: PermissionRequest[] = [];
    private queueLock = false;

    // name to enabled
    private streams: pxt.Map<boolean> = {};
    private messages: pxt.Map<boolean> = {};

    constructor(private host: ExtensionHost) {
    }

    clear() {
        this.queueLock = false;
        this.pendingRequests = [];
    }

    streamingExtensions(): string[] {
        return Object.keys(this.streams);
    }

    messagesExtensions(): string[] {
        return Object.keys(this.messages);
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
            case "extinit": {
                const ri = resp as pxt.editor.InitializeResponse;
                ri.target = pxt.appTarget;
                this.sendResponse(resp);
                break;
            }
            case "extdatastream": {
                if (request?.body?.messages)
                    return this.permissionOperation(request.extId, Permissions.Messages, resp, (name, resp) => this.handleMessageStreamRequest(name, resp));
                else
                    return this.permissionOperation(request.extId, Permissions.Console, resp, (name, resp) => this.handleDataStreamRequest(name, resp));
            }
            case "extquerypermission": {
                const perm = this.getPermissions(request.extId)
                const r = resp as e.ExtensionResponse;
                r.resp = statusesToResponses(perm);
                this.sendResponse(r);
                break;
            }
            case "extrequestpermission":
                return this.requestPermissionsAsync(request.extId, resp as e.PermissionResponse, request.body);
            case "extusercode":
                return this.permissionOperation(request.extId, Permissions.ReadUserCode, resp, handleUserCodeRequest);
            case "extreadcode":
                handleReadCodeRequest(this.extIdToName[request.extId], resp as e.ReadCodeResponse);
                this.sendResponse(resp);
                break;
            case "extwritecode":
                const handleWriteCode = () => handleWriteCodeRequestAsync(this.extIdToName[request.extId], resp, request.body)
                    .done(() => this.sendResponse(resp));
                const missingDepdencies = resolveMissingDependencies(request.body as e.WriteExtensionFiles);
                if (missingDepdencies?.length)
                    this.permissionOperation(request.extId, Permissions.AddDependencies, resp, handleWriteCode);
                else // skip permission
                    handleWriteCode();
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

    trust(extId: string) {
        const status = PermissionStatus.Granted;
        this.statuses[extId] = {
            console: status,
            readUserCode: status,
            addDependencies: status,
            messages: status
        };
    }

    private getPermissions(id: string): e.Permissions<PermissionStatus> {
        if (!this.statuses[id]) {
            const status = PermissionStatus.NotYetPrompted;
            this.statuses[id] = {
                console: status,
                readUserCode: status,
                addDependencies: status,
                // must call trust to unlock this
                messages: PermissionStatus.Denied
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
            case Permissions.AddDependencies: status = perm.addDependencies; break;
            case Permissions.Messages: status = perm.messages; break;
            default: // should never happen
                status = PermissionStatus.NotAvailable; break;
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
                        case Permissions.AddDependencies:
                            this.statuses[id].addDependencies = newStatus; break;
                        // messages should never set by the user
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
        if (p.addDependencies) {
            promises.push(this.checkPermissionAsync(id, Permissions.AddDependencies));
        }
        // the user cannot request messages

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
            case Permissions.AddDependencies: status = perm.addDependencies; break;
            case Permissions.Messages: status = perm.messages; break;
        }
        return status === PermissionStatus.NotYetPrompted;
    }

    private handleDataStreamRequest(name: string, resp: e.ExtensionResponse) {
        // ASSERT: permission has been granted
        this.streams[name] = true;
    }

    private handleMessageStreamRequest(name: string, resp: e.ExtensionResponse) {
        // ASSERT: permission has been granted
        this.messages[name] = true;
    }
}

export async function resolveExtensionUrl(pkg: pxt.Package) {
    const { config, installedVersion } = pkg;
    const { extension } = config;

    const packagesConfig = await pxt.packagesConfigAsync()
    const parsedRepo = pxt.github.parseRepoId(installedVersion);
    const repoStatus = pxt.github.repoStatus(parsedRepo, packagesConfig);
    let url = "";
    let trusted = false;
    const debug = pxt.BrowserUtils.isLocalHost()
        && /debugextensions=1/i.test(window.location.href);
    const localDebug = !debug
        && pxt.BrowserUtils.isLocalHost()
        && /localeditorextensions=1/i.test(window.location.href)
        && extension.localUrl;
    if (debug) {
        /* tslint:disable:no-http-string */
        url = "http://localhost:3232/extension.html";
    } else if (localDebug) {
        url = extension.localUrl;
        trusted = /localeditorextensionstrusted=1/.test(window.location.href);
    }
    else if (extension.url
        && packagesConfig?.approvedEditorExtensionUrls
        && packagesConfig?.approvedEditorExtensionUrls?.indexOf(extension.url) > -1) {
        // custom url, but not support in editor
        pxt.log(`extension url ${extension.url} trusted`)
        url = extension.url;
        // must also be approved to be trusted
        trusted = repoStatus === pxt.github.GitRepoStatus.Approved;
    } else if (!parsedRepo) {
        const repoName = parsedRepo.fullName.substr(parsedRepo.fullName.indexOf(`/`) + 1);
        /* tslint:disable:no-http-string */
        url = `https://${parsedRepo.owner}.github.io/${repoName}/`;
    }
    pxt.log(`extension ${config.name}: resolved ${url}`)
    return { url, trusted, name: config.name, repoStatus }
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

function resolveMissingDependencies(files: e.WriteExtensionFiles) {
    let missingDependencies: string[];
    if (files?.dependencies) {
        // collect missing depdencies
        const mainPackage = pkg.mainEditorPkg() as pkg.EditorPackage;
        const cfg = pxt.Util.jsonTryParse(mainPackage?.files[pxt.CONFIG_NAME]?.content) as pxt.PackageConfig;
        // maybe we should really match the versions...
        if (cfg?.dependencies) { // give up if cfg is busted
            missingDependencies = Object.keys(files.dependencies)
                .filter(k => !cfg.dependencies[k]);
        }
    }
    return missingDependencies;
}

function handleWriteCodeRequestAsync(name: string, resp: e.WriteCodeResponse, files: e.WriteExtensionFiles) {
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

    let missingDependencies: string[];
    if (files.dependencies) {
        // collect missing depdencies
        const cfg = pxt.Util.jsonTryParse(mainPackage.files[pxt.CONFIG_NAME]?.content) as pxt.PackageConfig;
        // maybe we should really match the versions...
        if (cfg?.dependencies) { // give up if cfg is busted
            missingDependencies = Object.keys(files.dependencies)
                .filter(k => !cfg.dependencies[k]);
            needsUpdate = needsUpdate || !!missingDependencies?.length;
        }
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
        missingDependencies?.forEach(dep => cfg.dependencies[dep] = files.dependencies[dep]);
        return mainPackage.cloudSavePkgAsync();
    }).then(() => mainPackage.saveFilesAsync(true));
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
        console: statusToResponse(perm.console),
        addDependencies: statusToResponse(perm.addDependencies),
        messages: statusToResponse(perm.messages)
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