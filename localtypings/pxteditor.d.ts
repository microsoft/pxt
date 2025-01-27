/// <reference path="../built/pxtlib.d.ts" />
/// <reference path="./projectheader.d.ts" />
/// <reference path="./validatorPlan.d.ts" />

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

        /**
         * Frame identifier that can be passed to the iframe by adding the frameId query parameter
         */
        frameId?: string;
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
        | "switchpython"
        | "startsimulator"
        | "restartsimulator"
        | "stopsimulator" // EditorMessageStopRequest
        | "hidesimulator"
        | "showsimulator"
        | "closeflyout"
        | "newproject"
        | "importproject"
        | "importexternalproject"
        | "importtutorial"
        | "openheader"
        | "proxytosim" // EditorMessageSimulatorMessageProxyRequest
        | "undo"
        | "redo"
        | "renderblocks"
        | "renderpython"
        | "renderxml"
        | "renderbyblockid"
        | "setscale"
        | "startactivity"
        | "saveproject"
        | "compile"
        | "unloadproject"
        | "shareproject"
        | "savelocalprojectstocloud"
        | "projectcloudstatus"
        | "requestprojectcloudstatus"
        | "convertcloudprojectstolocal"
        | "setlanguagerestriction"
        | "gettoolboxcategories"
        | "getblockastext"

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
        | "serviceworkerregistered"
        | "runeval"
        | "precachetutorial"

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

    export interface EditorMessageImportExternalProjectRequest extends EditorMessageRequest {
        action: "importexternalproject";
        // project to load
        project: pxt.workspace.Project;
    }

    export interface EditorMessageImportExternalProjectResponse extends EditorMessageResponse {
        action: "importexternalproject";
        resp: {
            importUrl: string;
        };
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
        layout?: BlockLayout;
    }

    export interface EditorMessageRenderXmlRequest extends EditorMessageRequest {
        action: "renderxml";
        // xml to render
        xml: string;
        snippetMode?: boolean;
        layout?: BlockLayout;
    }

    export interface EditorMessageRenderByBlockIdRequest extends EditorMessageRequest {
        action: "renderbyblockid";
        blockId: string;
        snippetMode?: boolean;
        layout?: BlockLayout;
    }

    export interface EditorMessageRunEvalRequest extends EditorMessageRequest {
        action: "runeval";
        validatorPlan: pxt.blocks.ValidatorPlan;
        planLib: pxt.blocks.ValidatorPlan[];
    }

    export interface EditorMessageRenderBlocksResponse {
        svg: SVGSVGElement;
        xml: Promise<any>;
    }

    export interface EditorMessageRenderXmlResponse {
        svg: SVGSVGElement;
        resultXml: Promise<any>;
    }

    export interface EditorMessageRenderByBlockIdResponse {
        svg: SVGSVGElement;
        resultXml: Promise<any>;
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

    export interface PrecacheTutorialRequest extends EditorMessageRequest {
        action: "precachetutorial";
        data: pxt.github.GHTutorialResponse;
        lang?: string;
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

    export interface EditorMessageGetToolboxCategoriesRequest extends EditorMessageRequest {
        action: "gettoolboxcategories";
        advanced?: boolean;
    }

    export interface EditorMessageGetToolboxCategoriesResponse {
        categories: pxt.editor.ToolboxCategoryDefinition[];
    }

    export interface EditorMessageGetBlockAsTextRequest extends EditorMessageRequest {
        action: "getblockastext";
        blockId: string;
    }

    export interface EditorMessageGetBlockAsTextResponse {
        blockAsText: pxt.editor.BlockAsText | undefined;
    }

    export interface EditorMessageServiceWorkerRegisteredRequest extends EditorMessageRequest {
        action: "serviceworkerregistered";
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

    export const enum FilterState {
        Hidden = 0,
        Visible = 1,
        Disabled = 2
    }

    export const enum BlockLayout {
        None = 0,
        Align = 1,
        // Shuffle deprecated
        Clean = 3,
        Flow = 4
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

    export interface IEditor {
        undo(): void;
        redo(): void;
        hasUndo(): boolean;
        hasRedo(): boolean;
        zoomIn(): void;
        zoomOut(): void;
        resize(): void;
        setScale(scale: number): void;
    }

    export interface IFile {
        name: string;
        virtual?: boolean; // gimmick to switch views
    }

    export interface FileHistoryEntry {
        id: string;
        name: string;
        pos: any;
    }

    export interface EditorSettings {
        editorFontSize: number;
        fileHistory: FileHistoryEntry[];
    }

    export const enum ErrorListState {
        HeaderOnly = "errorListHeader",
        Expanded = "errorListExpanded"
    }

    export const enum MuteState {
        Muted = "muted",
        Unmuted = "unmuted",
        Disabled = "disabled"
    }

    export const enum SimState {
        Stopped,
        // waiting to be started
        Pending,
        Starting,
        Running
    }

    export interface NativeHostMessage {
        name?: string;
        download?: string;
        save?: string;
        cmd?: string;
    }

    export interface IAppProps { }
    export interface IAppState {
        active?: boolean; // is this tab visible at all
        header?: pxt.workspace.Header;
        editorState?: EditorState;
        currFile?: IFile;
        fileState?: string;
        showFiles?: boolean;
        sideDocsLoadUrl?: string; // set once to load the side docs frame
        sideDocsCollapsed?: boolean;
        projectName?: string;
        suppressPackageWarning?: boolean;
        tutorialOptions?: pxt.tutorial.TutorialOptions;
        lightbox?: boolean;
        keymap?: boolean;
        simState?: SimState;
        autoRun?: boolean;
        resumeOnVisibility?: boolean;
        compiling?: boolean;
        isSaving?: boolean;
        publishing?: boolean;
        hideEditorFloats?: boolean;
        collapseEditorTools?: boolean;
        showBlocks?: boolean;
        showParts?: boolean;
        fullscreen?: boolean;
        showMiniSim?: boolean;
        mute?: MuteState;
        embedSimView?: boolean;
        editorPosition?: {
            lineNumber: number;
            column: number;
            file: IFile;
        }; // ensure that this line is visible when loading the editor
        tracing?: boolean;
        debugging?: boolean;
        debugFirstRun?: boolean;
        bannerVisible?: boolean;
        pokeUserComponent?: string;
        flashHint?: boolean;
        editorOffset?: string;
        print?: boolean;
        greenScreen?: boolean;
        accessibleBlocks?: boolean;
        home?: boolean;
        hasError?: boolean;
        cancelledDownload?: boolean;
        simSerialActive?: boolean;
        deviceSerialActive?: boolean;
        errorListState?: ErrorListState;
        screenshoting?: boolean;
        extensionsVisible?: boolean;
        isMultiplayerGame?: boolean; // Arcade: Does the current project contain multiplayer blocks?
        onboarding?: pxt.tour.BubbleStep[];
        feedback?: boolean;
    }

    export interface EditorState {
        filters?: pxt.editor.ProjectFilters;
        searchBar?: boolean; // show the search bar in editor
        hasCategories?: boolean; // show categories in toolbox
    }

    export interface ExampleImportOptions {
        name: string;
        path: string;
        loadBlocks?: boolean;
        prj?: pxt.ProjectTemplate;
        preferredEditor?: string;
    }

    export interface StartActivityOptions {
        activity: Activity;
        path: string;
        title?: string;
        editor?: string;
        focus?: boolean;
        importOptions?: ExampleImportOptions;
        previousProjectHeaderId?: string;
        carryoverPreviousCode?: boolean;
    }

    export interface ModalDialogButton {
        label: string;
        url?: string;
    }

    export interface ModalDialogOptions {
        header: string;
        body: string;
        buttons?: ModalDialogButton[];
    }

    export interface ScreenshotData {
        data?: ImageData;
        delay?: number;
        event?: "start" | "stop";
    }

    export interface SimulatorStartOptions {
        clickTrigger?: boolean;
    }

    export interface ImportFileOptions {
        extension?: boolean;
        openHomeIfFailed?: boolean;
    }

    export interface UserInfo {
        id: string;
        userName?: string;
        name: string;
        profile?: string;
        loginHint?: string;
        initials?: string;
        photo?: string;
    }

    export interface ShareData {
        url: string;
        embed: {
            code?: string;
            editor?: string;
            simulator?: string;
            url?: string;
        }
        qr?: string;
        error?: any;
    }

    export type Activity = "tutorial" | "recipe" | "example";

    export interface IProjectView {
        state: IAppState;
        setState(st: IAppState): void;
        forceUpdate(): void;

        reloadEditor(): void;
        openBlocks(): void;
        openJavaScript(giveFocusOnLoading?: boolean): void;
        openPython(giveFocusOnLoading?: boolean): void;
        openAssets(): void;
        openSettings(): void;
        openSimView(): void;
        openSimSerial(): void;
        openDeviceSerial(): void;
        openPreviousEditor(): void;

        switchTypeScript(): void;
        openTypeScriptAsync(): Promise<void>;
        openPythonAsync(): Promise<void>;
        saveBlocksToTypeScriptAsync(): Promise<string>;

        saveFileAsync(): Promise<void>;
        saveCurrentSourceAsync(): Promise<void>;
        saveProjectAsync(): Promise<void>;
        loadHeaderAsync(h: pxt.workspace.Header): Promise<void>;
        reloadHeaderAsync(): Promise<void>;
        importProjectAsync(prj: pxt.workspace.Project, editorState?: EditorState): Promise<void>;
        importTutorialAsync(markdown: string): Promise<void>;
        openProjectByHeaderIdAsync(headerId: string): Promise<void>;
        overrideTypescriptFile(text: string): void;
        overrideBlocksFile(text: string): void;
        resetTutorialTemplateCode(keepAssets: boolean): Promise<void>;

        exportAsync(): Promise<string>;

        newEmptyProject(name?: string, documentation?: string, preferredEditor?: string): void;
        newProject(options?: pxt.editor.ProjectCreationOptions): void;
        createProjectAsync(options: pxt.editor.ProjectCreationOptions): Promise<void>;
        importExampleAsync(options: ExampleImportOptions): Promise<void>;
        showScriptManager(): void;
        importProjectDialog(): void;
        removeProject(): void;
        editText(): void;

        hasCloudSync(): boolean;

        getPreferredEditor(): string;
        saveAndCompile(): void;
        updateHeaderName(name: string): void;
        updateHeaderNameAsync(name: string): Promise<void>;
        compile(): void;

        setFile(fn: IFile, line?: number): void;
        setSideFile(fn: IFile, line?: number): void;
        navigateToError(diag: pxtc.KsDiagnostic): void;
        setSideDoc(path: string, blocksEditor?: boolean): void;
        setSideMarkdown(md: string): void;
        setSideDocCollapsed(shouldCollapse?: boolean): void;
        removeFile(fn: IFile, skipConfirm?: boolean): void;
        updateFileAsync(name: string, content: string, open?: boolean): Promise<void>;

        openHome(): void;
        unloadProjectAsync(home?: boolean): Promise<void>;
        setTutorialStep(step: number): void;
        setTutorialInstructionsExpanded(value: boolean): void;
        exitTutorial(): void;
        completeTutorialAsync(): Promise<void>;
        showTutorialHint(): void;
        isTutorial(): boolean;
        onEditorContentLoaded(): void;
        pokeUserActivity(): void;
        stopPokeUserActivity(): void;
        clearUserPoke(): void;
        setHintSeen(step: number): void;
        setEditorOffset(): void;

        anonymousPublishHeaderByIdAsync(headerId: string, projectName?: string): Promise<ShareData>;
        publishCurrentHeaderAsync(persistent: boolean, screenshotUri?: string): Promise<string>;
        publishAsync (name: string, screenshotUri?: string, forceAnonymous?: boolean): Promise<ShareData>;

        startStopSimulator(opts?: SimulatorStartOptions): void;
        stopSimulator(unload?: boolean, opts?: SimulatorStartOptions): void;
        restartSimulator(): void;
        startSimulator(opts?: SimulatorStartOptions): void;
        runSimulator(): void;
        isSimulatorRunning(): boolean;
        expandSimulator(): void;
        collapseSimulator(): void;
        toggleSimulatorCollapse(): void;
        toggleSimulatorFullscreen(): void;
        setSimulatorFullScreen(enabled: boolean): void;
        proxySimulatorMessage(content: string): void;
        toggleTrace(intervalSpeed?: number): void;
        setTrace(enabled: boolean, intervalSpeed?: number): void;
        toggleMute(): void;
        setMute(state: MuteState): void;
        openInstructions(): void;
        closeFlyout(): void;
        printCode(): void;
        requestScreenshotAsync(): Promise<string>;
        downloadScreenshotAsync(): Promise<void>;

        toggleDebugging(): void;
        dbgPauseResume(): void;
        dbgStepInto(): void;
        dbgStepOver(): void;
        dbgInsertBreakpoint(): void;

        setBannerVisible(b: boolean): void;
        typecheckNow(): void;
        shouldPreserveUndoStack(): boolean;

        openExtension(extension: string, url: string, consentRequired?: boolean, trusted?: boolean): void;
        handleExtensionRequest(request: pxt.editor.ExtensionRequest): void;

        fireResize(): void;
        updateEditorLogo(left: number, rgba?: string): number;

        loadBlocklyAsync(): Promise<void>;
        isBlocksEditor(): boolean;
        isTextEditor(): boolean;
        isPxtJsonEditor(): boolean;
        blocksScreenshotAsync(pixelDensity?: number, encodeBlocks?: boolean): Promise<string>;
        renderBlocksAsync(req: pxt.editor.EditorMessageRenderBlocksRequest): Promise<pxt.editor.EditorMessageRenderBlocksResponse>;
        renderPythonAsync(req: pxt.editor.EditorMessageRenderPythonRequest): Promise<pxt.editor.EditorMessageRenderPythonResponse>;
        renderXml(req: pxt.editor.EditorMessageRenderXmlRequest): pxt.editor.EditorMessageRenderXmlResponse;
        renderByBlockIdAsync(req: pxt.editor.EditorMessageRenderByBlockIdRequest): Promise<pxt.editor.EditorMessageRenderByBlockIdResponse>;

        // FIXME (riknoll) need to figure out how to type this better
        // getBlocks(): Blockly.Block[];
        getBlocks(): any[];
        getToolboxCategories(advanced?: boolean): pxt.editor.EditorMessageGetToolboxCategoriesResponse;
        getBlockAsText(blockId: string): pxt.editor.BlockAsText | undefined;

        toggleHighContrast(): void;
        setHighContrast(on: boolean): void;
        toggleGreenScreen(): void;
        toggleAccessibleBlocks(): void;
        setAccessibleBlocks(enabled: boolean): void;
        launchFullEditor(): void;
        resetWorkspace(): void;

        settings: EditorSettings;

        isEmbedSimActive(): boolean;
        isBlocksActive(): boolean;
        isJavaScriptActive(): boolean;
        isPythonActive(): boolean;
        isAssetsActive(): boolean;

        editor: IEditor;

        startActivity(options: StartActivityOptions): void;
        showLightbox(): void;
        hideLightbox(): void;
        showOnboarding(): void;
        hideOnboarding(): void;
        showKeymap(show: boolean): void;
        toggleKeymap(): void;
        signOutGithub(): void;

        showReportAbuse(): void;
        showLanguagePicker(): void;
        showShareDialog(title?: string, kind?: "multiplayer" | "vscode" | "share"): void;
        showAboutDialog(): void;
        showFeedbackDialog(): void;
        showTurnBackTimeDialogAsync(): Promise<void>;

        showLoginDialog(continuationHash?: string): void;
        showProfileDialog(location?: string): void;

        showImportUrlDialog(): void;
        showImportFileDialog(options?: ImportFileOptions): void;
        showImportGithubDialog(): void;

        showResetDialog(): void;
        showExitAndSaveDialog(): void;
        showChooseHwDialog(skipDownload?: boolean): void;
        showExperimentsDialog(): void;

        showPackageDialog(query?: string): void;
        showBoardDialogAsync(features?: string[], closeIcon?: boolean): Promise<void>;
        checkForHwVariant(): boolean;
        pairAsync(): Promise<boolean>;

        createModalClasses(classes?: string): string;
        showModalDialogAsync(options: ModalDialogOptions): Promise<void>;

        askForProjectCreationOptionsAsync(): Promise<pxt.editor.ProjectCreationOptions>;

        pushScreenshotHandler(handler: (msg: ScreenshotData) => void): void;
        popScreenshotHandler(): void;

        openNewTab(header: pxt.workspace.Header, dependent: boolean): void;
        createGitHubRepositoryAsync(): Promise<void>;
        saveLocalProjectsToCloudAsync(headerIds: string[]): Promise<pxt.Map<string> | undefined>;
        requestProjectCloudStatus(headerIds: string[]): Promise<void>;
        convertCloudProjectsToLocal(userId: string): Promise<void>;
        setLanguageRestrictionAsync(restriction: pxt.editor.LanguageRestriction): Promise<void>;
        hasHeaderBeenPersistentShared(): boolean;
        getSharePreferenceForHeader(): boolean;
        saveSharePreferenceForHeaderAsync(anonymousByDefault: boolean): Promise<void>;
    }

    export interface IHexFileImporter {
        id: string;
        canImport(data: pxt.cpp.HexFile): boolean;
        importAsync(project: IProjectView, data: pxt.cpp.HexFile): Promise<void>;
    }

    export interface IResourceImporter {
        id: string;
        canImport(data: File): boolean;
        importAsync(project: IProjectView, data: File): Promise<void>;
    }

    export interface ISettingsProps {
        parent: IProjectView;
        visible?: boolean;
        collapsed?: boolean;
        simSerialActive?: boolean;
        devSerialActive?: boolean;
    }

    export interface IFieldCustomOptions {
        selector: string;
        // FIXME (riknoll) need to figure out how to type this better. Also this type is from pxtblocks, but
        // it uses types dervied from Blockly
        // editor: Blockly.FieldCustomConstructor;
        editor: any;
        text?: string;
        validator?: any;
    }


    export interface ExtensionOptions {
        blocklyToolbox: ToolboxDefinition;
        monacoToolbox: ToolboxDefinition;
        projectView: IProjectView;
        showNotification: (msg: string) => void;
    }

    export interface IToolboxOptions {
        blocklyToolbox?: ToolboxDefinition;
        monacoToolbox?: ToolboxDefinition;
    }

    export interface ExtensionResult {
        hexFileImporters?: IHexFileImporter[];
        resourceImporters?: IResourceImporter[];
        beforeCompile?: () => void;
        patchCompileResultAsync?: (r: pxtc.CompileResult) => Promise<void>;
        deployAsync?: (r: pxtc.CompileResult) => Promise<void>;
        saveOnlyAsync?: (r: ts.pxtc.CompileResult) => Promise<void>;
        saveProjectAsync?: (project: pxt.cpp.HexFile) => Promise<void>;
        renderBrowserDownloadInstructions?: () => any /* JSX.Element */;
        renderUsbPairDialog?: (firmwareUrl?: string, failedOnce?: boolean) => any /* JSX.Element */;
        renderIncompatibleHardwareDialog?: (unsupportedParts: string[]) => any /* JSX.Element */;
        showUploadInstructionsAsync?: (fn: string, url: string, confirmAsync: (options: any) => Promise<number>) => Promise<void>;
        showProgramTooLargeErrorAsync?: (variants: string[], confirmAsync: (options: any) => Promise<number>) => Promise<pxt.commands.RecompileOptions>;
        toolboxOptions?: IToolboxOptions;
        blocklyPatch?: (pkgTargetVersion: string, dom: Element) => void;
        webUsbPairDialogAsync?: (pairAsync: () => Promise<boolean>, confirmAsync: (options: any) => Promise<number>) => Promise<number>;
        mkPacketIOWrapper?: (io: pxt.packetio.PacketIO) => pxt.packetio.PacketIOWrapper;
        onPostHostMessage?: (msg: pxt.editor.EditorMessageRequest) => void;
        onPerfMilestone?: (payload: { milestone: string, time: number, params?: Map<string> }) => void;
        onPerfMeasurement?: (payload: { name: string, start: number, duration: number, params?: Map<string> }) => void;
    
        // Used with the @tutorialCompleted macro. See docs/writing-docs/tutorials.md for more info
        onTutorialCompleted?: () => void;
        onMarkdownActivityLoad?: (path: string, title?: string, editorProjectName?: string) => Promise<void>;

        // Used with @codeStart, @codeStop metadata (MINECRAFT HOC ONLY)
        onCodeStart?: () => void;
        onCodeStop?: () => void;

        experiments?: Experiment[];
    }

    export interface Experiment {
        id: string; // == field in apptheme also assumes image at /static/experiments/ID.png
        name: string;
        description: string;
        feedbackUrl?: string; // allows user to put feedback
        enableOnline?: boolean; // requires internet connection, disable in offline app
        onClick?: () => void; // code to run when the experiment is clicked
    }

    export interface FieldExtensionOptions {
    }

    export interface FieldExtensionResult {
        fieldEditors?: IFieldCustomOptions[];
    }

    export interface ToolboxDefinition {
        loops?: ToolboxCategoryDefinition;
        logic?: ToolboxCategoryDefinition;
        variables?: ToolboxCategoryDefinition;
        maths?: ToolboxCategoryDefinition;
        text?: ToolboxCategoryDefinition;
        arrays?: ToolboxCategoryDefinition;
        functions?: ToolboxCategoryDefinition;
    }

    export interface ToolboxCategoryDefinition {
        /**
         * The display name for the category
         */
        name?: string;

        /**
         * The icon of this category
         */
        icon?: string;

        /**
         * The color of this category
         */
        color?: string;

        /**
         * The weight of the category relative to other categories in the toolbox
         */
        weight?: number;

        /**
         * Whether or not the category should be placed in the advanced category
         */
        advanced?: boolean;

        /**
         * Blocks to appear in the category. Specifying this field will override
         * all existing blocks in the category. The ordering of the blocks is
         * determined by the ordering of this array.
         */
        blocks?: ToolboxBlockDefinition[];

        /**
         * Ordering of category groups
         */
        groups?: string[],
    }

    export interface ToolboxBlockDefinition {
        /**
         * Internal id used to refer to this block or snippet, must be unique
         */
        name: string;

        /**
         * Group label used to categorize block.  Blocks are arranged with other
         * blocks that share the same group.
         */
        group?: string,

        /**
         * Indicates an advanced API. Advanced APIs appear after basic ones in the
         * toolbox
         */
        advanced?: boolean;

        /**
         * The weight for the block. Blocks are arranged in order of they appear in the category
         * definition's array but the weight can be specified in the case that other APIs are
         * dynamically added to the category (eg. loops.forever())
         */
        weight?: number;

        /**
         * Description of code to appear in the hover text
         */
        jsDoc?: string

        /**
         * TypeScript snippet of code to insert when dragged into editor
         */
        snippet?: string;

        /**
         * Python snippet of code to insert when dragged into editor
         */
        pySnippet?: string;

        /**
         * TypeScript name used for highlighting the snippet, uses name if not defined
         */
        snippetName?: string;

        /**
         * Python name used for highlighting the snippet, uses name if not defined
         */
        pySnippetName?: string;

        /**
         * Display just the snippet and nothing else. Should be set to true for
         * language constructs (eg. for-loops) and to false for function
         * calls (eg. Math.random())
         */
        snippetOnly?: boolean;

        /**
         * The return type of the block. This is used to determine the shape of the block rendered.
         */
        retType?: string;

        /**
         * The block definition in XML for the blockly toolbox.
         */
        blockXml?: string;

        /**
         * The Blockly block id used to identify this block.
         */
        blockId?: string;
    }

    export interface BlockAsText {
        parts: BlockTextPart[];
    }

    export interface BlockTextPart {
        kind: "label" | "break" | "param",
        content?: string,
    }

    interface BaseAssetEditorRequest {
        id?: number;
        files: pxt.Map<string>;
        palette?: string[];
    }

    interface OpenAssetEditorRequest extends BaseAssetEditorRequest {
        type: "open";
        assetId: string;
        assetType: pxt.AssetType;
    }

    interface CreateAssetEditorRequest extends BaseAssetEditorRequest {
        type: "create";
        assetType: pxt.AssetType;
        displayName?: string;
    }

    interface SaveAssetEditorRequest extends BaseAssetEditorRequest {
        type: "save";
    }

    interface DuplicateAssetEditorRequest extends BaseAssetEditorRequest {
        type: "duplicate";
        assetId: string;
        assetType: pxt.AssetType;
    }

    type AssetEditorRequest = OpenAssetEditorRequest | CreateAssetEditorRequest | SaveAssetEditorRequest | DuplicateAssetEditorRequest;

    interface BaseAssetEditorResponse {
        id?: number;
    }

    interface OpenAssetEditorResponse extends BaseAssetEditorResponse {
        type: "open";
    }

    interface CreateAssetEditorResponse extends BaseAssetEditorResponse {
        type: "create";
    }

    interface SaveAssetEditorResponse extends BaseAssetEditorResponse {
        type: "save";
        files: pxt.Map<string>;
    }

    interface DuplicateAssetEditorResponse extends BaseAssetEditorResponse {
        type: "duplicate";
    }

    type AssetEditorResponse = OpenAssetEditorResponse | CreateAssetEditorResponse | SaveAssetEditorResponse | DuplicateAssetEditorResponse;

    interface AssetEditorRequestSaveEvent {
        type: "event";
        kind: "done-clicked";
    }

    interface AssetEditorReadyEvent {
        type: "event";
        kind: "ready";
    }

    type AssetEditorEvent = AssetEditorRequestSaveEvent | AssetEditorReadyEvent;
}

declare namespace pxt.workspace {
    export interface WorkspaceProvider {
        listAsync(): Promise<pxt.workspace.Header[]>; // called from workspace.syncAsync (including upon startup)
        getAsync(h: pxt.workspace.Header): Promise<File>;
        setAsync(h: pxt.workspace.Header, prevVersion: pxt.workspace.Version, text?: pxt.workspace.ScriptText): Promise<pxt.workspace.Version>;
        deleteAsync?: (h: pxt.workspace.Header, prevVersion: pxt.workspace.Version) => Promise<void>;
        resetAsync(): Promise<void>;
        loadedAsync?: () => Promise<void>;
        getSyncState?: () => pxt.editor.EditorSyncState;

        // optional screenshot support
        saveScreenshotAsync?: (h: pxt.workspace.Header, screenshot: string, icon: string) => Promise<void>;

        // optional asset (large binary file) support
        saveAssetAsync?: (id: string, filename: string, data: Uint8Array) => Promise<void>;
        listAssetsAsync?: (id: string) => Promise<Asset[]>;

        fireEvent?: (ev: pxt.editor.EditorEvent) => void;
    }
}
