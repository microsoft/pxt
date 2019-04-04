namespace pxt.editor {
    export interface EditorMessage {
        /**
         * Constant identifier
         */
        type: "pxteditor" | "pxthost" | "pxtpkgext" | "pxtsim",
        /**
         * Original request id
         */
        id?: string;
        /**
         * flag to request response
         */
        response?: boolean;
    }

    export interface EditorMessageResponse extends EditorMessage {
        /**
         * Additional response payload provided by the command
         */
        resp?: any;
        /**
         * indicate if operation started or completed successfully
         */
        success: boolean;
        /**
         * Error object if any
         */
        error?: any;
    }

    export interface EditorMessageRequest extends EditorMessage {
        /**
         * Request action
         */
        action: "switchblocks"
        | "switchjavascript"
        | "startsimulator"
        | "restartsimulator"
        | "stopsimulator" // EditorMessageStopRequest
        | "hidesimulator"
        | "showsimulator"
        | "closeflyout"
        | "newproject"
        | "importproject"
        | "proxytosim" // EditorMessageSimulatorMessageProxyRequest
        | "undo"
        | "redo"
        | "renderblocks"
        | "setscale"

        | "toggletrace" // EditorMessageToggleTraceRequest
        | "settracestate" // EditorMessageSetTraceStateRequest

        | "workspacesync" // EditorWorspaceSyncRequest
        | "workspacereset"
        | "workspacesave" // EditorWorkspaceSaveRequest
        | "workspaceloaded"
        | "workspaceevent" // EditorWorspaceEvent

        | "event"
        | "simevent"

        // package extension messasges
        | ExtInitializeType
        | ExtDataStreamType
        | ExtQueryPermissionType
        | ExtRequestPermissionType
        | ExtUserCodeType
        | ExtReadCodeType
        | ExtWriteCodeType
        ;
    }

    /**
     * Request sent by the editor when a tick/error/expection is registered
     */
    export interface EditorMessageEventRequest extends EditorMessageRequest {
        action: "event";
        // metric identifier
        tick: string;
        // error category if any
        category?: string;
        // error message if any
        message?: string;
        // custom data
        data?: Map<string | number>;
    }

    export interface EditorMessageStopRequest extends EditorMessageRequest {
        action: "stopsimulator";
        /**
         * Indicates if simulator iframes should be unloaded or kept hot.
         */
        unload?: boolean;
    }

    export interface EditorMessageNewProjectRequest extends EditorMessageRequest {
        action: "newproject";
        /**
         * Additional optional to create new project
         */
        options?: ProjectCreationOptions;
    }

    export interface EditorMessageSetScaleRequest extends EditorMessageRequest {
        action: "setscale";
        scale: number;
    }

    export interface EditorMessageSimulatorMessageProxyRequest extends EditorMessageRequest {
        action: "proxytosim";
        /**
         * Content to send to the simulator
         */
        content: any;
    }

    export interface EditorWorkspaceSyncRequest extends EditorMessageRequest {
        /**
         * Synching projects from host into
         */
        action: "workspacesync" | "workspacereset" | "workspaceloaded";
    }

    export interface EditorWorkspaceEvent extends EditorMessageRequest {
        action: "workspaceevent";
        event: pxt.editor.events.Event;
    }

    // UI properties to sync on load
    export interface EditorSyncState {
        // (optional) filtering argument
        filters?: pxt.editor.ProjectFilters;
        // (optional) show or hide the search bar
        searchBar?: boolean;
    }

    export interface EditorWorkspaceSyncResponse extends EditorMessageResponse {
        /*
        * Full list of project, required for init
        */
        projects: pxt.workspace.Project[];
        // (optional) filtering argument
        editor?: EditorSyncState;
        // (optional) controller id, used for determining what the parent controller is
        controllerId?: string;
    }

    export interface EditorWorkspaceSaveRequest extends EditorMessageRequest {
        action: "workspacesave";
        /*
        * Modified project
        */
        project: pxt.workspace.Project;
    }

    export interface EditorMessageImportProjectRequest extends EditorMessageRequest {
        action: "importproject";
        // project to load
        project: pxt.workspace.Project;
        // (optional) filtering argument
        filters?: pxt.editor.ProjectFilters;
        searchBar?: boolean;
    }

    export interface EditorMessageRenderBlocksRequest extends EditorMessageRequest {
        action: "renderblocks";
        // typescript code to render
        ts: string;
    }

    export interface EditorMessageRenderBlocksResponse {
        mime: "application/svg+xml";
        data: string;
    }

    export interface EditorSimulatorEvent extends EditorMessageRequest {
        action: "simevent";
        subtype: "toplevelfinished" | "started" | "stopped" | "resumed"
    }

    export interface EditorSimulatorStoppedEvent extends EditorSimulatorEvent {
        subtype: "stopped";
        exception?: string;
    }

    export interface EditorMessageToggleTraceRequest extends EditorMessageRequest {
        action: "toggletrace";
        // interval speed for the execution trace
        intervalSpeed?: number;
    }

    export interface EditorMessageSetTraceStateRequest extends EditorMessageRequest {
        action: "settracestate";
        enabled: boolean;
        // interval speed for the execution trace
        intervalSpeed?: number;
    }

    export interface PackageExtensionData {
        ts: string;
        json?: any;
    }

    export interface EditorPkgExtMessageRequest extends EditorMessageRequest {
        // extension identifier
        package: string;
    }

    export interface EditorPkgExtMessageResponse extends EditorMessageResponse {
        // extension identifier
        package: string;
    }

    export interface EditorSimulatorTickEvent extends EditorMessageEventRequest {
        type: "pxtsim";
    }

    const pendingRequests: pxt.Map<{
        resolve: (res?: EditorMessageResponse | PromiseLike<EditorMessageResponse>) => void;
        reject: (err: any) => void;
    }> = {};
    /**
     * Binds incoming window messages to the project view.
     * Requires the "allowParentController" flag in the pxtarget.json/appTheme object.
     *
     * When the project view receives a request (EditorMessageRequest),
     * it starts the command and returns the result upon completion.
     * The response (EditorMessageResponse) contains the request id and result.
     * Some commands may be async, use the ``id`` field to correlate to the original request.
     */
    export function bindEditorMessages(getEditorAsync: () => Promise<IProjectView>) {
        const allowEditorMessages = (pxt.appTarget.appTheme.allowParentController || pxt.shell.isControllerMode())
                                    && pxt.BrowserUtils.isIFrame();
        const allowExtensionMessages = pxt.appTarget.appTheme.allowPackageExtensions;
        const allowSimTelemetry = pxt.appTarget.appTheme.allowSimulatorTelemetry;

        if (!allowEditorMessages && !allowExtensionMessages && !allowSimTelemetry) return;

        window.addEventListener("message", (msg: MessageEvent) => {
            const data = msg.data as EditorMessage;
            if (!data || !/^pxt(host|editor|pkgext|sim)$/.test(data.type)) return false;

            if (data.type === "pxtpkgext" && allowExtensionMessages) {
                // Messages sent to the editor iframe from a child iframe containing an extension
                getEditorAsync().then(projectView => {
                    projectView.handleExtensionRequest(data as ExtensionRequest);
                })
            }
            else if (data.type === "pxtsim" && allowSimTelemetry) {
                const event = data as EditorMessageEventRequest;
                if (event.action === "event") {
                    if (event.category || event.message) {
                        pxt.reportError(event.category, event.message, event.data as Map<string>)
                    }
                    else {
                        pxt.tickEvent(event.tick, event.data);
                    }
                }
            }
            else if (allowEditorMessages) {
                // Messages sent to the editor from the parent frame
                let p = Promise.resolve();
                let resp: any = undefined;
                if (data.type == "pxthost") { // response from the host
                    const req = pendingRequests[data.id];
                    if (!req) {
                        pxt.debug(`pxthost: unknown request ${data.id}`);
                    } else {
                        p = p.then(() => req.resolve(data as EditorMessageResponse));
                    }
                } else if (data.type == "pxteditor") { // request from the editor
                    p = p.then(() => {
                        return getEditorAsync().then(projectView => {
                            const req = data as EditorMessageRequest;
                            pxt.debug(`pxteditor: ${req.action}`);
                            switch (req.action.toLowerCase()) {
                                case "switchjavascript": return Promise.resolve().then(() => projectView.openJavaScript());
                                case "switchpython": return Promise.resolve().then(() => projectView.openPython());
                                case "switchblocks": return Promise.resolve().then(() => projectView.openBlocks());
                                case "startsimulator": return Promise.resolve().then(() => projectView.startSimulator());
                                case "restartsimulator": return Promise.resolve().then(() => projectView.restartSimulator());
                                case "hidesimulator": return Promise.resolve().then(() => projectView.collapseSimulator());
                                case "showsimulator": return Promise.resolve().then(() => projectView.expandSimulator());
                                case "closeflyout": return Promise.resolve().then(() => projectView.closeFlyout());
                                case "redo": return Promise.resolve()
                                    .then(() => {
                                        const editor = projectView.editor;
                                        if (editor && editor.hasRedo())
                                            editor.redo();
                                    });
                                case "undo": return Promise.resolve()
                                    .then(() => {
                                        const editor = projectView.editor;
                                        if (editor && editor.hasUndo())
                                            editor.undo();
                                    });
                                case "setscale": {
                                    const zoommsg = data as EditorMessageSetScaleRequest;
                                    return Promise.resolve()
                                        .then(() => projectView.editor.setScale(zoommsg.scale));
                                }
                                case "stopsimulator": {
                                    const stop = data as EditorMessageStopRequest;
                                    return Promise.resolve()
                                        .then(() => projectView.stopSimulator(stop.unload));
                                }
                                case "newproject": {
                                    const create = data as EditorMessageNewProjectRequest;
                                    return Promise.resolve()
                                        .then(() => projectView.newProject(create.options));
                                }
                                case "importproject": {
                                    const load = data as EditorMessageImportProjectRequest;
                                    return Promise.resolve()
                                        .then(() => projectView.importProjectAsync(load.project, {
                                            filters: load.filters,
                                            searchBar: load.searchBar
                                        }));
                                }
                                case "proxytosim": {
                                    const simmsg = data as EditorMessageSimulatorMessageProxyRequest;
                                    return Promise.resolve()
                                        .then(() => projectView.proxySimulatorMessage(simmsg.content));
                                }
                                case "renderblocks": {
                                    const rendermsg = data as EditorMessageRenderBlocksRequest;
                                    return Promise.resolve()
                                        .then(() => projectView.renderBlocksAsync(rendermsg))
                                        .then((r: any) => {
                                            return r.xml.then((svg: any) => {
                                                resp = svg.xml;
                                            })
                                        });
                                }
                                case "toggletrace": {
                                    const togglemsg = data as EditorMessageToggleTraceRequest;
                                    return Promise.resolve()
                                        .then(() => projectView.toggleTrace(togglemsg.intervalSpeed));
                                }
                                case "settracestate": {
                                    const trcmsg = data as EditorMessageSetTraceStateRequest;
                                    return Promise.resolve()
                                        .then(() => projectView.setTrace(trcmsg.enabled, trcmsg.intervalSpeed));
                                }
                            }
                            return Promise.resolve();
                        });
                    })
                }
                p.done(() => sendResponse(data, resp, true, undefined),
                    (err) => sendResponse(data, resp, false, err))
            }

            return true;
        }, false)
    }

    /**
     * Sends analytics messages upstream to container if any
     */
    export function enableControllerAnalytics() {
        if (!pxt.appTarget.appTheme.allowParentController || !pxt.BrowserUtils.isIFrame()) return;

        const te = pxt.tickEvent;
        pxt.tickEvent = function (id: string, data?: Map<string | number>): void {
            if (te) te(id, data);
            postHostMessageAsync(<EditorMessageEventRequest>{
                type: 'pxthost',
                action: 'event',
                tick: id,
                response: false,
                data
            });
        }

        const rexp = pxt.reportException;
        pxt.reportException = function (err: any, data: pxt.Map<string>): void {
            if (rexp) rexp(err, data);
            try {
                postHostMessageAsync(<EditorMessageEventRequest>{
                    type: 'pxthost',
                    action: 'event',
                    tick: 'error',
                    message: err.message,
                    response: false,
                    data
                })
            } catch (e) {

            }
        };

        const re = pxt.reportError;
        pxt.reportError = function (cat: string, msg: string, data?: pxt.Map<string | number>): void {
            if (re) re(cat, msg, data);
            postHostMessageAsync(<EditorMessageEventRequest>{
                type: 'pxthost',
                action: 'event',
                tick: 'error',
                category: cat,
                message: msg,
                data
            })
        }
    }

    function sendResponse(request: EditorMessage, resp: any, success: boolean, error: any) {
        if (request.response) {
            window.parent.postMessage({
                type: request.type,
                id: request.id,
                resp,
                success,
                error
            }, "*");
        }
    }

    /**
     * Posts a message from the editor to the host
     */
    export function postHostMessageAsync(msg: EditorMessageRequest): Promise<EditorMessageResponse> {
        return new Promise<EditorMessageResponse>((resolve, reject) => {
            const env = Util.clone(msg);
            env.id = ts.pxtc.Util.guidGen();
            if (msg.response)
                pendingRequests[env.id] = { resolve, reject };
            window.parent.postMessage(env, "*");
            if (!msg.response)
                resolve(undefined)
        })
    }
}