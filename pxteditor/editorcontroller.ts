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
        | "importtutorial"
        | "openheader"
        | "proxytosim" // EditorMessageSimulatorMessageProxyRequest
        | "undo"
        | "redo"
        | "renderblocks"
        | "renderpython"
        | "setscale"
        | "startactivity"
        | "saveproject"
        | "unloadproject"
        | "shareproject"
        | "savelocalprojectstocloud"
        | "projectcloudstatus"
        | "requestprojectcloudstatus"
        | "convertcloudprojectstolocal"
        | "setlanguagerestriction"

        | "toggletrace" // EditorMessageToggleTraceRequest
        | "togglehighcontrast"
        | "sethighcontrast" // EditorMessageSetHighContrastRequest
        | "togglegreenscreen"
        | "settracestate" //
        | "setsimulatorfullscreen" // EditorMessageSimulatorFullScreenRequest

        | "print" // print code
        | "pair" // pair device

        | "workspacesync" // EditorWorspaceSyncRequest
        | "workspacereset"
        | "workspacesave" // EditorWorkspaceSaveRequest
        | "workspaceloaded"
        | "workspaceevent" // EditorWorspaceEvent

        | "workspacediagnostics" // compilation results

        | "event"
        | "simevent"
        | "info" // return info data`
        | "tutorialevent"

        // package extension messasges
        | ExtInitializeType
        | ExtDataStreamType
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

    export type EditorMessageTutorialEventRequest = EditorMessageTutorialProgressEventRequest |
        EditorMessageTutorialCompletedEventRequest |
        EditorMessageTutorialLoadedEventRequest |
        EditorMessageTutorialExitEventRequest;

    export interface EditorMessageTutorialProgressEventRequest extends EditorMessageRequest {
        action: "tutorialevent";
        tutorialEvent: "progress"
        currentStep: number;
        totalSteps: number;
        isCompleted: boolean;
        tutorialId: string;
        projectHeaderId: string;
    }

    export interface EditorMessageTutorialCompletedEventRequest extends EditorMessageRequest {
        action: "tutorialevent";
        tutorialEvent: "completed";
        tutorialId: string;
        projectHeaderId: string;
    }

    export interface EditorMessageTutorialLoadedEventRequest extends EditorMessageRequest {
        action: "tutorialevent";
        tutorialEvent: "loaded";
        tutorialId: string;
        projectHeaderId: string;
    }

    export interface EditorMessageTutorialExitEventRequest extends EditorMessageRequest {
        action: "tutorialevent";
        tutorialEvent: "exit";
        tutorialId: string;
        projectHeaderId: string;
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

    export interface EditorWorkspaceDiagnostics extends EditorMessageRequest {
        action: "workspacediagnostics";
        operation: "compile" | "decompile" | "typecheck";
        output: string;
        diagnostics: {
            code: number;
            category: "error" | "warning" | "message";
            fileName?: string;
            start?: number;
            length?: number;
            line?: number;
            column?: number;
            endLine?: number;
            endColumn?: number;
        }[];
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

    export interface EditorMessageSaveLocalProjectsToCloud extends EditorMessageRequest {
        action: "savelocalprojectstocloud";
        headerIds: string[];
    }

    export interface EditorMessageSaveLocalProjectsToCloudResponse extends EditorMessageResponse {
        action: "savelocalprojectstocloud";
        headerIdMap?: pxt.Map<string>;
    }

    export interface EditorMessageProjectCloudStatus extends EditorMessageRequest {
        action: "projectcloudstatus";
        headerId: string;
        status: pxt.cloud.CloudStatus;
    }

    export interface EditorMessageRequestProjectCloudStatus extends EditorMessageRequest {
        action: "requestprojectcloudstatus";
        headerIds: string[];
    }

    export interface EditorMessageConvertCloudProjectsToLocal extends EditorMessageRequest {
        action: "convertcloudprojectstolocal";
        userId: string;
    }

    export interface EditorMessageImportTutorialRequest extends EditorMessageRequest {
        action: "importtutorial";
        // markdown to load
        markdown: string;
    }

    export interface EditorMessageOpenHeaderRequest extends EditorMessageRequest {
        action: "openheader";
        headerId: string;
    }

    export interface EditorMessageRenderBlocksRequest extends EditorMessageRequest {
        action: "renderblocks";
        // typescript code to render
        ts: string;
        // rendering options
        snippetMode?: boolean;
        layout?: pxt.blocks.BlockLayout;
    }

    export interface EditorMessageRenderBlocksResponse {
        svg: SVGSVGElement;
        xml: Promise<any>;
    }

    export interface EditorMessageRenderPythonRequest extends EditorMessageRequest {
        action: "renderpython";
        // typescript code to render
        ts: string;
    }

    export interface EditorMessageRenderPythonResponse {
        python: string;
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

    export interface EditorMessageSetSimulatorFullScreenRequest extends EditorMessageRequest {
        action: "setsimulatorfullscreen";
        enabled: boolean;
    }

    export interface EditorMessageSetHighContrastRequest extends EditorMessageRequest {
        action: "sethighcontrast";
        on: boolean;
    }

    export interface EditorMessageStartActivity extends EditorMessageRequest {
        action: "startactivity";
        activityType: "tutorial" | "example" | "recipe";
        path: string;
        title?: string;
        previousProjectHeaderId?: string;
        carryoverPreviousCode?: boolean;
    }

    export interface InfoMessage {
        versions: pxt.TargetVersions;
        locale: string;
        availableLocales?: string[];
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

    export interface EditorShareRequest extends EditorMessageRequest {
        action: "shareproject";
        headerId: string;
        projectName: string;
    }

    export interface EditorShareResponse extends EditorMessageRequest {
        action: "shareproject";
        script: Cloud.JsonScript;
    }

    export interface EditorSetLanguageRestriction extends EditorMessageRequest {
        action: "setlanguagerestriction";
        restriction: pxt.editor.LanguageRestriction;
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

        window.addEventListener("message", async (msg: MessageEvent) => {
            const data = msg.data as EditorMessage;
            if (!data || !/^pxt(host|editor|pkgext|sim)$/.test(data.type)) return false;

            if (data.type === "pxtpkgext" && allowExtensionMessages) {
                // Messages sent to the editor iframe from a child iframe containing an extension
                const projectView = await getEditorAsync();
                projectView.handleExtensionRequest(data as ExtensionRequest);
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
                let resp: any = undefined;
                try {
                    if (data.type == "pxthost") { // response from the host
                        const req = pendingRequests[data.id];
                        if (!req) {
                            pxt.debug(`pxthost: unknown request ${data.id}`);
                        } else {
                            await req.resolve(data as EditorMessageResponse);
                        }
                    } else if (data.type == "pxteditor") { // request from the editor
                        resp = handleEditorMessage(
                            data as EditorMessageRequest,
                            await getEditorAsync()
                        );
                    }
                    sendResponse(data, resp, true, undefined);
                } catch (err) {
                    sendResponse(data, resp, false, err);
                }
            }
            return true;
        }, false)
    }

    async function handleEditorMessage(data: EditorMessageRequest, projectView: IProjectView): Promise<any> {
        const req = data as EditorMessageRequest;
        pxt.debug(`pxteditor: ${req.action}`);
        switch (req.action.toLowerCase()) {
            case "switchjavascript":
                projectView.openJavaScript();
                return undefined;
            case "switchpython":
                projectView.openPython();
                return undefined;
            case "switchblocks":
                projectView.openBlocks();
                return undefined;
            case "startsimulator":
                projectView.startSimulator();
                return undefined;
            case "restartsimulator":
                projectView.restartSimulator();
                return undefined;
            case "hidesimulator":
                projectView.collapseSimulator();
                return undefined;
            case "showsimulator":
                projectView.expandSimulator();
                return undefined;
            case "closeflyout":
                projectView.closeFlyout();
                return undefined;
            case "unloadproject":
                await projectView.unloadProjectAsync();
                return undefined;
            case "saveproject":
                await projectView.saveProjectAsync();
                return undefined;
            case "redo": {
                const editor = projectView.editor;
                if (editor?.hasRedo())
                    editor.redo();
                return undefined;
            }
            case "undo": {
                const editor = projectView.editor;
                if (editor?.hasUndo())
                    editor.undo();
                return undefined;
            };
            case "setscale": {
                const zoommsg = data as EditorMessageSetScaleRequest;
                projectView.editor.setScale(zoommsg.scale);
                return undefined;
            }
            case "stopsimulator": {
                const stop = data as EditorMessageStopRequest;
                projectView.stopSimulator(stop.unload);
                return undefined;
            }
            case "newproject": {
                const create = data as EditorMessageNewProjectRequest;
                projectView.newProject(create.options);
                return undefined;
            }
            case "importproject": {
                const load = data as EditorMessageImportProjectRequest;
                await projectView.importProjectAsync(load.project, {
                    filters: load.filters,
                    searchBar: load.searchBar
                });
                return undefined;
            }
            case "openheader": {
                const open = data as EditorMessageOpenHeaderRequest;
                await projectView.openProjectByHeaderIdAsync(open.headerId);
                return undefined;
            }
            case "startactivity": {
                const msg = data as EditorMessageStartActivity;
                let tutorialPath = msg.path;
                let editorProjectName: string = undefined;
                if (/^([jt]s|py|blocks?):/i.test(tutorialPath)) {
                    if (/^py:/i.test(tutorialPath))
                        editorProjectName = pxt.PYTHON_PROJECT_NAME;
                    else if (/^[jt]s:/i.test(tutorialPath))
                        editorProjectName = pxt.JAVASCRIPT_PROJECT_NAME;
                    else
                        editorProjectName = pxt.BLOCKS_PROJECT_NAME;
                    tutorialPath = tutorialPath.substr(tutorialPath.indexOf(':') + 1);
                }

                projectView.startActivity({
                    activity: msg.activityType,
                    path: tutorialPath,
                    title: msg.title,
                    editor: editorProjectName,
                    previousProjectHeaderId: msg.previousProjectHeaderId,
                    carryoverPreviousCode: msg.carryoverPreviousCode
                });
                return undefined;
            }
            case "importtutorial": {
                const load = data as EditorMessageImportTutorialRequest;
                await projectView.importTutorialAsync(load.markdown);
                return undefined;
            }
            case "proxytosim": {
                const simmsg = data as EditorMessageSimulatorMessageProxyRequest;
                projectView.proxySimulatorMessage(simmsg.content);
                return undefined;
            }
            case "renderblocks": {
                const rendermsg = data as EditorMessageRenderBlocksRequest;
                const renderRes = await projectView.renderBlocksAsync(rendermsg);
                // TODO jowunder this feels weird. look at renderBlocksAsync a little
                const svg = await renderRes.xml;
                return svg.xml;
            }
            case "renderpython": {
                const rendermsg = data as EditorMessageRenderPythonRequest;
                const renderRes = await projectView.renderPythonAsync(rendermsg);
                return renderRes.python;
            }
            case "toggletrace": {
                const togglemsg = data as EditorMessageToggleTraceRequest;
                projectView.toggleTrace(togglemsg.intervalSpeed);
                return undefined;
            }
            case "settracestate": {
                const trcmsg = data as EditorMessageSetTraceStateRequest;
                projectView.setTrace(trcmsg.enabled, trcmsg.intervalSpeed);;
                return undefined;
            }
            case "setsimulatorfullscreen": {
                const fsmsg = data as EditorMessageSetSimulatorFullScreenRequest;
                projectView.setSimulatorFullScreen(fsmsg.enabled);
                return undefined;
            }
            case "togglehighcontrast": {
                projectView.toggleHighContrast();
                return undefined;
            }
            case "sethighcontrast": {
                const hcmsg = data as EditorMessageSetHighContrastRequest;
                projectView.setHighContrast(hcmsg.on);
                return undefined;
            }
            case "togglegreenscreen": {
                projectView.toggleGreenScreen();
                return undefined;
            }
            case "print": {
                projectView.printCode();
                return undefined;
            }
            case "pair": {
                return projectView.pairAsync();
            }
            case "info": {
                return <editor.InfoMessage> {
                    versions: pxt.appTarget.versions,
                    locale: ts.pxtc.Util.userLanguage(),
                    availableLocales: pxt.appTarget.appTheme.availableLocales
                };
            }
            case "shareproject": {
                const msg = data as EditorShareRequest;
                return projectView.anonymousPublishHeaderByIdAsync(msg.headerId, msg.projectName);
            }
            case "savelocalprojectstocloud": {
                const msg = data as EditorMessageSaveLocalProjectsToCloud;
                const guidMap = await projectView.saveLocalProjectsToCloudAsync(msg.headerIds);
                return <EditorMessageSaveLocalProjectsToCloudResponse> {
                    headerIdMap: guidMap
                };
            }
            case "requestprojectcloudstatus": {
                // Responses are sent as separate "projectcloudstatus" messages.
                const msg = data as EditorMessageRequestProjectCloudStatus;
                await projectView.requestProjectCloudStatus(msg.headerIds);
                return undefined
            }
            case "convertcloudprojectstolocal": {
                const msg = data as EditorMessageConvertCloudProjectsToLocal;
                await projectView.convertCloudProjectsToLocal(msg.userId);
                return undefined
            }
            case "setlanguagerestriction": {
                const msg = data as EditorSetLanguageRestriction;
                if (msg.restriction === "no-blocks") {
                    console.warn("no-blocks language restriction is not supported");
                    throw new Error("no-blocks language restriction is not supported")
                }
                await projectView.setLanguageRestrictionAsync(msg.restriction);
                return undefined;
            }
            default: {
                pxt.debug(`Unhandled pxteditor message ${req.action}`);
            }
        }
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
     * Determines if host messages should be posted
     */
    export function shouldPostHostMessages() {
        return pxt.appTarget.appTheme.allowParentController && pxt.BrowserUtils.isIFrame();
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