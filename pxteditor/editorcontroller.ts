namespace pxt.editor {
    export interface EditorMessageRequest {
        /**
         * identifier used to correlate request / responses
         */
        id?: string;
        /**
         * constant messageb identifier
         */
        type: "pxteditor";
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
        | "proxytosim" // EditorMessageSimulatorMessageProxyRequest
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

    export interface EditorMessageResponse {
        /**
         * Constant identifier
         */
        type: "pxteditor",
        /**
         * Original request id
         */
        id?: string;
        /**
         * indicate if operation started or completed successfully
         */
        success: boolean;
        /**
         * Error object if any
         */
        error?: any;
    }

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
            const data = msg.data as EditorMessageRequest;
            if (!data || data.type != "pxteditor" || !data.action) return false;

            let p = Promise.resolve();
            switch (data.action.toLowerCase()) {
                // TODO: make async
                case "switchjavascript": p = p.then(() => projectView.openJavaScript()); break;
                case "switchblocks": p = p.then(() => projectView.openBlocks()); break;
                case "startsimulator": p = p.then(() => projectView.startSimulator()); break;
                case "restartsimulator": p = p.then(() => projectView.restartSimulator()); break;
                case "hidesimulator": p = p.then(() => projectView.collapseSimulator()); break;
                case "showsimulator": p = p.then(() => projectView.expandSimulator()); break;
                case "stopsimulator": {
                    const stop = data as EditorMessageStopRequest;
                    p = p.then(() => projectView.stopSimulator(stop.unload)); break;
                }
                case "newproject":  {
                    const create = data as EditorMessageNewProjectRequest;
                    p = p.then(() => projectView.newProject(create.options)); break;
                }
                case "proxytosim": {
                    const simmsg = data as EditorMessageSimulatorMessageProxyRequest;
                    p = p.then(() => projectView.proxySimulatorMessage(simmsg.content)); break;
                }
            }
            p.done(() => sendResponse(data, true, undefined),
                (err) => sendResponse(data, false, err))

            return true;
        }, false)
    }

    function sendResponse(request: EditorMessageRequest, success: boolean, error: any) {
        window.parent.postMessage({
            type: "pxteditor",
            id: request.id,
            success,
            error
        }, "*");
    }
}