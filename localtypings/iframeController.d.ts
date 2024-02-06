/// <reference path="../built/pxtlib.d.ts" />
/// <reference path="../built/pxtblocks.d.ts" />
/// <reference path="./projectheader.d.ts" />

declare namespace pxt.editor {
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
        | "editorcontentloaded"
        | "runeval"

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
        data?: pxt.Map<string | number>;
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

    export interface EditorContentLoadedRequest extends EditorMessageRequest {
        action: "editorcontentloaded";
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
        event: EditorEvent;
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
        filters?: ProjectFilters;
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
        filters?: ProjectFilters;
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

    export interface EditorMessageRunEvalRequest extends EditorMessageRequest {
        action: "runeval";
        validatorPlan: pxt.blocks.ValidatorPlan;
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
        script: pxt.Cloud.JsonScript;
    }

    export interface EditorSetLanguageRestriction extends EditorMessageRequest {
        action: "setlanguagerestriction";
        restriction: pxt.editor.LanguageRestriction;
    }

    export interface DataStreams<T> {
        console?: T;
        messages?: T;
    }

    export interface ExtensionFiles {
        code?: string;
        json?: string;
        jres?: string;
        asm?: string;
    }

    export interface WriteExtensionFiles extends ExtensionFiles {
        dependencies?: pxt.Map<string>;
    }

    export interface ExtensionMessage extends EditorMessage {
        type: "pxtpkgext";
    }

    export interface ExtensionResponse extends EditorMessageResponse {
        type: "pxtpkgext";
        extId: string;
    }

    export interface ExtensionRequest extends EditorMessageRequest {
        type: "pxtpkgext";
        extId: string;
        body?: any;
    }

    /**
     * Events are fired by the editor on the extension iFrame. Extensions
     * receive events, they don't send them.
     */
    export interface ExtensionEvent extends ExtensionMessage {
        event: string;
        target: string;
    }

    /**
     * Event fired when the extension is loaded.
     */
    export interface LoadedEvent extends ExtensionEvent {
        event: "extloaded";
    }

    /**
     * Event fired when the extension becomes visible.
     */
    export interface ShownEvent extends ExtensionEvent {
        event: "extshown";
    }

    /**
     * Event fired when the extension becomes hidden.
     */
    export interface HiddenEvent extends ExtensionEvent {
        event: "exthidden";
        body: HiddenReason;
    }

    export type HiddenReason = "useraction" | "other";

    /**
     * Event fired when console data is received
     */
    export interface ConsoleEvent extends ExtensionEvent {
        event: "extconsole";
        body: {
            source: string;
            sim: boolean;
            data: string;
        }
    }

    /**
     * Event fired when a message packet is received
     */
    export interface MessagePacketEvent extends ExtensionEvent {
        event: "extmessagepacket";
        body: {
            source?: string;
            channel: string;
            data: Uint8Array;
        }
    }

    /**
     * Event fired when extension is first shown. Extension
     * should send init request in response
     */
    export type ExtInitializeType = "extinit";

    export interface InitializeRequest extends ExtensionRequest {
        action: ExtInitializeType;
        body: string;
    }

    export interface InitializeResponse extends ExtensionResponse {
        target?: pxt.AppTarget;
    }

    /**
     * Requests data stream event to be fired. Permission will
     * be requested if not already received.
     */
    export type ExtDataStreamType = "extdatastream";

    export interface DataStreamRequest extends ExtensionRequest {
        action: ExtDataStreamType;
        body: DataStreams<boolean>;
    }

    export interface DataStreamResponse extends ExtensionResponse {
        resp: DataStreams<boolean>;
    }

    /**
     * Request to read the user's code. Will request permission if
     * not already granted
     */
    export type ExtUserCodeType = "extusercode";

    export interface UserCodeRequest extends ExtensionRequest {
        action: ExtUserCodeType;
    }

    export interface UserCodeResponse extends ExtensionResponse {
        /* A mapping of file names to their contents */
        resp?: { [index: string]: string };
    }

    /**
     * Request to read the files saved by this extension
     */
    export type ExtReadCodeType = "extreadcode";

    export interface ReadCodeRequest extends ExtensionRequest {
        action: ExtReadCodeType;
    }

    export interface ReadCodeResponse extends ExtensionResponse {
        action: ExtReadCodeType;

        body?: ExtensionFiles;
    }

    /**
     * Request to write the JSON and/or TS files saved
     * by this extension
     */
    export type ExtWriteCodeType = "extwritecode";

    export interface WriteCodeRequest extends ExtensionRequest {
        action: ExtWriteCodeType;

        body?: WriteExtensionFiles;
    }

    export interface WriteCodeResponse extends ExtensionResponse {
    }

    export interface ProjectCreationOptions {
        prj?: pxt.ProjectTemplate;
        name?: string;
        documentation?: string;
        filesOverride?: pxt.Map<string>;
        filters?: ProjectFilters;
        temporary?: boolean;
        tutorial?: pxt.tutorial.TutorialOptions;
        dependencies?: pxt.Map<string>;
        tsOnly?: boolean; // DEPRECATED: use LanguageRestriction.NoBlocks or LanguageRestriction.JavaScriptOnly instead
        languageRestriction?: pxt.editor.LanguageRestriction;
        preferredEditor?: string; // preferred editor to open, pxt.BLOCKS_PROJECT_NAME, ...
        extensionUnderTest?: string; // workspace id of the extension under test
        skillmapProject?: boolean;
        simTheme?: Partial<pxt.PackageConfig>;
        firstProject?: boolean;
    }

    export interface ProjectFilters {
        namespaces?: { [index: string]: FilterState; }; // Disabled = 2, Hidden = 0, Visible = 1
        blocks?: { [index: string]: FilterState; }; // Disabled = 2, Hidden = 0, Visible = 1
        fns?: { [index: string]: FilterState; }; // Disabled = 2, Hidden = 0, Visible = 1
        defaultState?: FilterState; // hide, show or disable all by default
    }

    export enum FilterState {
        Hidden = 0,
        Visible = 1,
        Disabled = 2
    }

    export type EditorType = 'blocks' | 'ts';

    export interface EditorEvent {
        type: string;
        editor: EditorType;
    }

    export interface CreateEvent extends EditorEvent {
        type: "create";
        blockId: string;
    }

    export interface UIEvent extends EditorEvent {
        type: "ui";
        action: "groupHelpClicked";
        data?: pxt.Map<string>;
    }
}