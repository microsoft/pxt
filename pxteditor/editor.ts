namespace pxt.editor {
    export enum SimState {
        Stopped,
        // waiting to be started
        Pending,
        Starting,
        Running
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

    export function isBlocks(f: IFile) {
        return U.endsWith(f.name, ".blocks")
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

    export enum ErrorListState {
        HeaderOnly = "errorListHeader",
        Expanded = "errorListExpanded"
    }

    export enum MuteState {
        Muted = "muted",
        Unmuted = "unmuted",
        Disabled = "disabled"
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
    }

    export interface EditorState {
        filters?: pxt.editor.ProjectFilters;
        searchBar?: boolean; // show the search bar in editor
        hasCategories?: boolean; // show categories in toolbox
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
        languageRestriction?: LanguageRestriction;
        preferredEditor?: string; // preferred editor to open, pxt.BLOCKS_PROJECT_NAME, ...
        extensionUnderTest?: string; // workspace id of the extension under test
        skillmapProject?: boolean;
        simTheme?: Partial<pxt.PackageConfig>;
        firstProject?: boolean;
    }

    export interface ExampleImportOptions {
        name: string;
        path: string;
        loadBlocks?: boolean;
        prj?: ProjectTemplate;
        preferredEditor?: string;
    }

    export interface StartActivityOptions {
        activity: Activity;
        path: string;
        title?: string;
        editor?: string;
        focus?: boolean;
        importOptions?: pxt.editor.ExampleImportOptions;
        previousProjectHeaderId?: string;
        carryoverPreviousCode?: boolean;
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
        importProjectAsync(prj: pxt.workspace.Project, editorState?: pxt.editor.EditorState): Promise<void>;
        importTutorialAsync(markdown: string): Promise<void>;
        openProjectByHeaderIdAsync(headerId: string): Promise<void>;
        overrideTypescriptFile(text: string): void;
        overrideBlocksFile(text: string): void;
        resetTutorialTemplateCode(keepAssets: boolean): Promise<void>;

        exportAsync(): Promise<string>;

        newEmptyProject(name?: string, documentation?: string, preferredEditor?: string): void;
        newProject(options?: ProjectCreationOptions): void;
        createProjectAsync(options: ProjectCreationOptions): Promise<void>;
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
        publishAsync (name: string, screenshotUri?: string, forceAnonymous?: boolean): Promise<pxt.editor.ShareData>;

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
        handleExtensionRequest(request: ExtensionRequest): void;

        fireResize(): void;
        updateEditorLogo(left: number, rgba?: string): number;

        loadBlocklyAsync(): Promise<void>;
        isBlocksEditor(): boolean;
        isTextEditor(): boolean;
        isPxtJsonEditor(): boolean;
        blocksScreenshotAsync(pixelDensity?: number, encodeBlocks?: boolean): Promise<string>;
        renderBlocksAsync(req: EditorMessageRenderBlocksRequest): Promise<EditorMessageRenderBlocksResponse>;
        renderPythonAsync(req: EditorMessageRenderPythonRequest): Promise<EditorMessageRenderPythonResponse>;

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

        askForProjectCreationOptionsAsync(): Promise<ProjectCreationOptions>;

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
        editor: Blockly.FieldCustomConstructor;
        text?: string;
        validator?: any;
    }


    export interface ExtensionOptions {
        blocklyToolbox: ToolboxDefinition;
        monacoToolbox: ToolboxDefinition;
        projectView: IProjectView;
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

        // Used with the @tutorialCompleted macro. See docs/writing-docs/tutorials.md for more info
        onTutorialCompleted?: () => void;

        // Used with @codeStart, @codeStop metadata (MINECRAFT HOC ONLY)
        onCodeStart?: () => void;
        onCodeStop?: () => void;
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

    export let initExtensionsAsync: (opts: ExtensionOptions) => Promise<ExtensionResult>
        = opts => Promise.resolve<ExtensionResult>({});

    export let initFieldExtensionsAsync: (opts: FieldExtensionOptions) => Promise<FieldExtensionResult>
        = opts => Promise.resolve<FieldExtensionResult>({});

    export interface NativeHostMessage {
        name?: string;
        download?: string;
        save?: string;
        cmd?: string;
    }

    export let HELP_IMAGE_URI = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjYiIGhlaWdodD0iMjYiIHZpZXdCb3g9IjAgMCAyNiAyNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTMiIGN5PSIxMyIgcj0iMTMiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0xNy45NTIgOS4xODQwMkMxNy45NTIgMTAuMjU2IDE3LjgxNiAxMS4wNzIgMTcuNTQ0IDExLjYzMkMxNy4yODggMTIuMTkyIDE2Ljc1MiAxMi43OTIgMTUuOTM2IDEzLjQzMkMxNS4xMiAxNC4wNzIgMTQuNTc2IDE0LjU4NCAxNC4zMDQgMTQuOTY4QzE0LjA0OCAxNS4zMzYgMTMuOTIgMTUuNzM2IDEzLjkyIDE2LjE2OFYxNi45NkgxMS44MDhDMTEuNDI0IDE2LjQ2NCAxMS4yMzIgMTUuODQgMTEuMjMyIDE1LjA4OEMxMS4yMzIgMTQuNjg4IDExLjM4NCAxNC4yODggMTEuNjg4IDEzLjg4OEMxMS45OTIgMTMuNDg4IDEyLjUzNiAxMi45NjggMTMuMzIgMTIuMzI4QzE0LjEwNCAxMS42NzIgMTQuNjI0IDExLjE2OCAxNC44OCAxMC44MTZDMTUuMTM2IDEwLjQ0OCAxNS4yNjQgOS45NjgwMiAxNS4yNjQgOS4zNzYwMkMxNS4yNjQgOC4yMDgwMiAxNC40MTYgNy42MjQwMiAxMi43MiA3LjYyNDAyQzExLjc2IDcuNjI0MDIgMTAuNzUyIDcuNzM2MDIgOS42OTYgNy45NjAwMkw5LjE0NCA4LjA4MDAyTDkgNi4wODgwMkMxMC40ODggNS41NjAwMiAxMS44NCA1LjI5NjAyIDEzLjA1NiA1LjI5NjAyQzE0LjczNiA1LjI5NjAyIDE1Ljk2OCA1LjYwODAyIDE2Ljc1MiA2LjIzMjAyQzE3LjU1MiA2Ljg0MDAyIDE3Ljk1MiA3LjgyNDAyIDE3Ljk1MiA5LjE4NDAyWk0xMS40IDIyVjE4LjY0SDE0LjE4NFYyMkgxMS40WiIgZmlsbD0iIzU5NUU3NCIvPgo8L3N2Zz4K';

    let _initEditorExtensionsPromise: Promise<void>;
    export function initEditorExtensionsAsync(): Promise<void> {
        if (!_initEditorExtensionsPromise) {
            _initEditorExtensionsPromise = Promise.resolve();
            if (pxt.appTarget && pxt.appTarget.appTheme && pxt.appTarget.appTheme.extendFieldEditors) {
                const opts: pxt.editor.FieldExtensionOptions = {};
                _initEditorExtensionsPromise = _initEditorExtensionsPromise
                    .then(() => pxt.BrowserUtils.loadBlocklyAsync())
                    .then(() => pxt.BrowserUtils.loadScriptAsync("fieldeditors.js"))
                    .then(() => pxt.editor.initFieldExtensionsAsync(opts))
                    .then(res => {
                        if (res.fieldEditors)
                            res.fieldEditors.forEach(fi => {
                                pxt.blocks.registerFieldEditor(fi.selector, fi.editor, fi.validator);
                            })
                    })
            }
        }
        return _initEditorExtensionsPromise;
    }
}
