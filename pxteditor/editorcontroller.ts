namespace pxt.editor {
    export interface EditorMessage {
        /**
         * Constant identifier
         */
        type: "pxteditor" | "pxthost",
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

        | "toggletrace" // EditorMessageToggleTraceRequest

        | "workspacesync" // EditorWorspaceSyncRequest
        | "workspacereset"
        | "workspacesave" // EditorWorkspaceSaveRequest

        | "event"
        | "simevent"
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
        action: "workspacesync" | "workspacereset";
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
    export function bindEditorMessages(projectView: IProjectView) {
        if (!pxt.appTarget.appTheme.allowParentController || !pxt.BrowserUtils.isIFrame()) return;

        window.addEventListener("message", (msg: MessageEvent) => {
            const data = msg.data as EditorMessage;
            if (!data || !/^pxt(host|editor)$/.test(data.type)) return false;

            let p = Promise.resolve();
            let resp: any = undefined;
            if (data.type == "pxthost") { // response from the host
                const req = pendingRequests[data.id];
                if (!req) {
                    pxt.debug(`pxthost: unknown request ${data.id}`);
                } else {
                    p = p.then(() => req.resolve(data as EditorMessageResponse));
                }
            } else { // request from the host
                const req = data as EditorMessageRequest;
                pxt.debug(`pxteditor: ${req.action}`);
                switch (req.action.toLowerCase()) {
                    case "switchjavascript": p = p.then(() => projectView.openJavaScript()); break;
                    case "switchblocks": p = p.then(() => projectView.openBlocks()); break;
                    case "startsimulator": p = p.then(() => projectView.startSimulator()); break;
                    case "restartsimulator": p = p.then(() => projectView.restartSimulator()); break;
                    case "hidesimulator": p = p.then(() => projectView.collapseSimulator()); break;
                    case "showsimulator": p = p.then(() => projectView.expandSimulator()); break;
                    case "closeflyout": p = p.then(() => projectView.closeFlyout()); break;
                    case "redo": p = p.then(() => {
                        const editor = projectView.editor;
                        if (editor && editor.hasRedo())
                            editor.redo();
                    }); break;
                    case "undo": p = p.then(() => {
                        const editor = projectView.editor;
                        if (editor && editor.hasUndo())
                            editor.undo();
                    }); break;
                    case "stopsimulator": {
                        const stop = data as EditorMessageStopRequest;
                        p = p.then(() => projectView.stopSimulator(stop.unload));
                        break;
                    }
                    case "newproject": {
                        const create = data as EditorMessageNewProjectRequest;
                        p = p.then(() => projectView.newProject(create.options));
                        break;
                    }
                    case "importproject": {
                        const load = data as EditorMessageImportProjectRequest;
                        p = p.then(() => projectView.importProjectAsync(load.project, {
                            filters: load.filters,
                            searchBar: load.searchBar
                        }));
                        break;
                    }
                    case "proxytosim": {
                        const simmsg = data as EditorMessageSimulatorMessageProxyRequest;
                        p = p.then(() => projectView.proxySimulatorMessage(simmsg.content));
                        break;
                    }
                    case "renderblocks": {
                        const rendermsg = data as EditorMessageRenderBlocksRequest;
                        p = p.then(() => projectView.renderBlocksAsync(rendermsg))
                            .then((img: string) => { resp = img; });
                        break;
                    }
                    case "toggletrace": {
                        const togglemsg = data as EditorMessageToggleTraceRequest;
                        p = p.then(() => projectView.toggleTrace(togglemsg.intervalSpeed));
                        break;
                    }
                }
            }
            p.done(() => sendResponse(data, resp, true, undefined),
                (err) => sendResponse(data, resp, false, err))

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
        pxt.reportError = function (cat: string, msg: string, data?: pxt.Map<string>): void {
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
            env.id = Util.guidGen();
            if (msg.response)
                pendingRequests[env.id] = { resolve, reject };
            window.parent.postMessage(env, "*");
            if (!msg.response)
                resolve(undefined)
        })
    }
}