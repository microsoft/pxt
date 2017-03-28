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
        | "newproject"
        | "importproject"
        | "proxytosim" // EditorMessageSimulatorMessageProxyRequest
        | "undo"
        | "redo"

        | "workspacesync" // EditorWorspaceSyncRequest
        | "workspacereset"
        | "workspacesave" // EditorWorkspaceSaveRequest
        ;
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

    export interface EditorWorkspaceSyncResponse extends EditorMessageResponse {
        /*
        * Full list of project, required for init
        */
        projects: pxt.workspace.Project[];
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
        if (!window.parent) return;

        window.addEventListener("message", (msg: MessageEvent) => {
            const data = msg.data as EditorMessage;
            if (!data || !/^pxt(host|editor)$/.test(data.type)) return false;

            let p = Promise.resolve();
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
                    case "redo": p = p.then(() => {
                        const editor = projectView.editor;
                        if (editor && editor.hasRedo())
                            editor.redo();
                    });
                    case "undo": p = p.then(() => {
                        const editor = projectView.editor;
                        if (editor && editor.hasUndo())
                            editor.undo();
                    });
                    case "stopsimulator": {
                        const stop = data as EditorMessageStopRequest;
                        p = p.then(() => projectView.stopSimulator(stop.unload)); break;
                    }
                    case "newproject": {
                        const create = data as EditorMessageNewProjectRequest;
                        p = p.then(() => projectView.newProject(create.options)); break;
                    }
                    case "importproject": {
                        const load = data as EditorMessageImportProjectRequest;
                        p = p.then(() => projectView.importProjectAsync(load.project, load.filters));
                    }
                    case "proxytosim": {
                        const simmsg = data as EditorMessageSimulatorMessageProxyRequest;
                        p = p.then(() => projectView.proxySimulatorMessage(simmsg.content)); break;
                    }
                }
            }
            p.done(() => sendResponse(data, true, undefined),
                (err) => sendResponse(data, false, err))

            return true;
        }, false)
    }

    function sendResponse(request: EditorMessage, success: boolean, error: any) {
        if (request.response) {
            window.parent.postMessage({
                type: request.type,
                id: request.id,
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