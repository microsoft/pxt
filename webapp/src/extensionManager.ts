import * as pxteditor from "../../pxteditor";
import * as pkg from "./package";

export interface ExtensionHost {
    send(name: string, message: pxt.editor.ExtensionMessage): void;
}

export class ExtensionManager {
    private nameToExtId: pxt.Map<string> = {};
    private extIdToName: pxt.Map<string> = {};

    // name to enabled
    private streams: pxt.Map<boolean> = {};
    private messages: pxt.Map<boolean> = {};

    constructor(private host: ExtensionHost) {
    }

    clear() {
    }

    streamingExtensions(): string[] {
        return Object.keys(this.streams);
    }

    messagesExtensions(): string[] {
        return Object.keys(this.messages);
    }

    handleExtensionMessage(message: pxt.editor.ExtensionMessage) {
        this.handleRequestAsync(message as pxt.editor.ExtensionRequest)
            .catch(e => { })
    }

    sendEvent(extId: string, event: string) {
        this.host.send(extId, mkEvent(event));
    }

    getExtId(name: string): string {
        if (!this.nameToExtId[name]) {
            this.nameToExtId[name] = ts.pxtc.Util.guidGen();
            this.extIdToName[this.nameToExtId[name]] = name;
        }
        return this.nameToExtId[name];
    }

    private sendResponse(response: pxt.editor.ExtensionResponse) {
        this.host.send(this.extIdToName[response.extId], response);
    }

    private handleRequestAsync(request: pxt.editor.ExtensionRequest): Promise<void> {
        const resp = mkResponse(request);
        switch (request.action) {
            case "extinit": {
                const ri = resp as pxt.editor.InitializeResponse;
                ri.target = pxt.appTarget;
                this.sendResponse(resp);
                break;
            }
            case "extdatastream": {
                if (request?.body?.messages)
                    return this.operation(request.extId, resp, (name, resp) => this.handleMessageStreamRequest(name, resp));
                else
                    return this.operation(request.extId, resp, (name, resp) => this.handleDataStreamRequest(name, resp));
            }
            case "extusercode":
                return this.operation(request.extId, resp, handleUserCodeRequest);
            case "extreadcode":
                handleReadCodeRequest(this.extIdToName[request.extId], resp as pxt.editor.ReadCodeResponse);
                this.sendResponse(resp);
                break;
            case "extwritecode":
                const handleWriteCode = () => handleWriteCodeRequestAsync(this.extIdToName[request.extId], resp, request.body)
                    .then(() => this.sendResponse(resp));
                const missingDepdencies = resolveMissingDependencies(request.body as pxt.editor.WriteExtensionFiles);
                if (missingDepdencies?.length)
                    this.operation(request.extId, resp, handleWriteCode);
                else
                    handleWriteCode();
                break;
        }

        return Promise.resolve();
    }

    private operation(id: string, resp: pxt.editor.ExtensionResponse, cb: (name: string, resp: pxt.editor.ExtensionResponse) => void) {
        return Promise.resolve()
            .then(() => {
                cb(this.extIdToName[id], resp);
                this.sendResponse(resp);
            })
            .catch(e => {
                resp.success = false;
                resp.error = e;
                this.sendResponse(resp);
            });
    }

    private handleDataStreamRequest(name: string, resp: pxt.editor.ExtensionResponse) {
        this.streams[name] = true;
    }

    private handleMessageStreamRequest(name: string, resp: pxt.editor.ExtensionResponse) {
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
        url = "http://localhost:3232/extension.html";
        trusted = true;
    } else if (localDebug) {
        url = extension.localUrl;
        trusted = true;
    }
    // ALL EDITOR EXTENSIONS MUST NOW BE IN THE APPROVED LIST
    else if (extension.url
        && repoStatus === pxt.github.GitRepoStatus.Approved
        && packagesConfig?.approvedEditorExtensionUrls?.indexOf(extension.url) > -1) {
        pxt.log(`extension url ${extension.url} trusted`)
        url = extension.url;
        trusted = true;
    }

    pxt.log(`extension ${config.name}: resolved ${url}`)
    return { url, name: config.name, trusted }
}

function handleUserCodeRequest(name: string, resp: pxt.editor.ExtensionResponse) {
    const mainPackage = pkg.mainEditorPkg() as pkg.EditorPackage;
    resp.resp = mainPackage.getAllFiles();
}

function handleReadCodeRequest(name: string, resp: pxt.editor.ReadCodeResponse) {
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

function resolveMissingDependencies(files: pxt.editor.WriteExtensionFiles) {
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

function handleWriteCodeRequestAsync(name: string, resp: pxt.editor.WriteCodeResponse, files: pxt.editor.WriteExtensionFiles) {
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
    }).then(() => mainPackage.saveFilesAsync());
}

function mkEvent(event: string): pxt.editor.ExtensionEvent {
    return {
        target: pxt.appTarget.id,
        type: "pxtpkgext",
        event
    };
}

function mkResponse(request: pxt.editor.ExtensionRequest, success = true): pxt.editor.ExtensionResponse {
    return {
        type: "pxtpkgext",
        id: request.id,
        extId: request.extId,
        success
    };
}
