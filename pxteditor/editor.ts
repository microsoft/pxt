namespace pxt.editor {

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

        tutorialOptions?: TutorialOptions;
        lightbox?: boolean;

        running?: boolean;
        resumeOnVisibility?: boolean;
        compiling?: boolean;
        isSaving?: boolean;
        publishing?: boolean;
        hideEditorFloats?: boolean;
        collapseEditorTools?: boolean;
        showBlocks?: boolean;
        showParts?: boolean;
        fullscreen?: boolean;
        mute?: boolean;
        embedSimView?: boolean;
        tracing?: boolean;
        debugging?: boolean;
        bannerVisible?: boolean;

        highContrast?: boolean;
        print?: boolean;
        greenScreen?: boolean;

        home?: boolean;
        hasError?: boolean;
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
        inTutorial?: boolean;
        dependencies?: pxt.Map<string>;
        tsOnly?: boolean;
        changeBoardOnLoad?: boolean; // if applicable, pop up the "boards" dialog after creating the project
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

    export interface TutorialOptions {
        tutorial?: string; // tutorial
        tutorialName?: string; // tutorial title
        tutorialStepInfo?: pxt.tutorial.TutorialStepInfo[];
        tutorialStep?: number; // current tutorial page
        tutorialReady?: boolean; // current tutorial page
    }

    export interface ModalDialogOptions {
        header: string;
        body: string;
    }

    export interface IProjectView {
        state: IAppState;
        setState(st: IAppState): void;
        forceUpdate(): void;

        reloadEditor(): void;

        openBlocks(): void;
        openJavaScript(giveFocusOnLoading?: boolean): void;
        openSettings(): void;
        openSimView(): void;
        openPreviousEditor(): void;

        switchTypeScript(): void;
        openTypeScriptAsync(): Promise<void>;
        saveBlocksToTypeScriptAsync(): Promise<string>;

        saveFileAsync(): Promise<void>;
        loadHeaderAsync(h: pxt.workspace.Header): Promise<void>;
        reloadHeaderAsync(): Promise<void>;
        importProjectAsync(prj: pxt.workspace.Project, editorState?: pxt.editor.EditorState): Promise<void>;
        overrideTypescriptFile(text: string): void;
        overrideBlocksFile(text: string): void;

        exportAsync(): Promise<string>;

        newEmptyProject(name?: string, documentation?: string): void;
        newProject(options?: ProjectCreationOptions): void;
        createProjectAsync(options: ProjectCreationOptions): Promise<void>;
        importProjectDialog(): void;
        removeProject(): void;
        editText(): void;
        pushPullAsync(): Promise<void>;

        getPreferredEditor(): string;
        saveAndCompile(): void;
        updateHeaderName(name: string): void;
        updateHeaderNameAsync(name: string): Promise<void>;
        compile(): void;

        setFile(fn: IFile): void;
        setSideFile(fn: IFile): void;
        setSideDoc(path: string, blocksEditor?: boolean): void;
        setSideMarkdown(md: string): void;
        removeFile(fn: IFile, skipConfirm?: boolean): void;
        updateFileAsync(name: string, content: string, open?: boolean): Promise<void>;

        openHome(): void;
        setTutorialStep(step: number): void;
        exitTutorial(): void;
        completeTutorial(): void;
        showTutorialHint(): void;

        anonymousPublishAsync(): Promise<string>;

        startStopSimulator(): void;
        stopSimulator(unload?: boolean): void;
        restartSimulator(debug?: boolean): void;
        startSimulator(debug?: boolean): void;
        runSimulator(): void;
        expandSimulator(): void;
        collapseSimulator(): void;
        toggleSimulatorCollapse(): void;
        toggleSimulatorFullscreen(): void;
        proxySimulatorMessage(content: string): void;
        toggleTrace(intervalSpeed?: number): void;
        setTrace(enabled: boolean, intervalSpeed?: number): void;
        toggleMute(): void;
        openInstructions(): void;
        closeFlyout(): void;
        printCode(): void;

        toggleDebugging(): void;
        dbgPauseResume(): void;
        dbgStepInto(): void;
        dbgStepOver(): void;
        dbgInsertBreakpoint(): void;

        setBannerVisible(b: boolean): void;
        typecheckNow(): void;

        openExtension(extension: string, url: string, consentRequired?: boolean): void;
        handleExtensionRequest(request: ExtensionRequest): void;

        fireResize(): void;
        updateEditorLogo(left: number, rgba?: string): void;

        loadBlocklyAsync(): Promise<void>;
        isBlocksEditor(): boolean;
        isTextEditor(): boolean;
        renderBlocksAsync(req: EditorMessageRenderBlocksRequest): Promise<any>;

        toggleHighContrast(): void;
        toggleGreenScreen(): void;
        pair(): void;
        launchFullEditor(): void;

        settings: EditorSettings;

        isEmbedSimActive(): boolean;
        isBlocksActive(): boolean;
        isJavaScriptActive(): boolean;

        editor: IEditor;

        startTutorial(tutorialId: string, tutorialTitle?: string): void;
        showLightbox(): void;
        hideLightbox(): void;

        showReportAbuse(): void;
        showLanguagePicker(): void;
        showShareDialog(): void;
        showAboutDialog(): void;

        showImportUrlDialog(): void;
        showImportFileDialog(): void;
        showImportGithubDialog(): void;

        showResetDialog(): void;
        showExitAndSaveDialog(): void;
        showChooseHwDialog(): void;
        showExperimentsDialog(): void;

        showPackageDialog(): void;
        showBoardDialog(): void;

        showModalDialogAsync(options: ModalDialogOptions): void;
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
        deployCoreAsync?: (r: pxtc.CompileResult) => Promise<void>;
        saveOnlyAsync?: (r: ts.pxtc.CompileResult) => Promise<void>;
        saveProjectAsync?: (project: pxt.cpp.HexFile) => Promise<void>;
        showUploadInstructionsAsync?: (fn: string, url: string, confirmAsync: (options: any) => Promise<number>) => Promise<void>;
        toolboxOptions?: IToolboxOptions;
        blocklyPatch?: (pkgTargetVersion: string, dom: Element) => void;
        webUsbPairDialogAsync?: (confirmAsync: (options: any) => Promise<number>) => Promise<number>;
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
         * Snippet of code to insert when dragged into editor
         */
        snippet?: string;

        /**
         * Name used for highlighting the snippet, uses name if not defined
         */
        snippetName?: string;

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
    }
}

