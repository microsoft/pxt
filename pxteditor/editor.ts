namespace pxt.editor {

    export interface IEditor {
        undo(): void;
        redo(): void;
        hasUndo(): boolean;
        hasRedo(): boolean;
        zoomIn(): void;
        zoomOut(): void;
        resize(): void;
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
        filters?: pxt.editor.ProjectFilters;
        currFile?: IFile;
        fileState?: string;
        showFiles?: boolean;
        sideDocsLoadUrl?: string; // set once to load the side docs frame
        sideDocsCollapsed?: boolean;
        projectName?: string;

        tutorialOptions?: TutorialOptions;
        hintShown?: boolean;

        notification?: pxt.Notification;

        running?: boolean;
        compiling?: boolean;
        publishing?: boolean;
        hideEditorFloats?: boolean;
        collapseEditorTools?: boolean;
        showBlocks?: boolean;
        showParts?: boolean;
        fullscreen?: boolean;
        mute?: boolean;
        embedSimView?: boolean;
        tracing?: boolean;

        highContrast?: boolean;
    }

    export interface ProjectCreationOptions {
        prj?: pxt.ProjectTemplate;
        name?: string;
        documentation?: string;
        filesOverride?: pxt.Map<string>;
        filters?: ProjectFilters;
        temporary?: boolean;
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

    export interface TutorialStepInfo {
        fullscreen?: boolean;
        hasHint?: boolean;
        content?: string;
        headerContent?: string;
        ariaLabel?: string;
    }

    export interface TutorialOptions {
        tutorial?: string; // tutorial
        tutorialName?: string; // tutorial title
        tutorialSteps?: string[]; // tutorial steps
        tutorialStepInfo?: TutorialStepInfo[];
        tutorialStep?: number; // current tutorial page
        tutorialReady?: boolean; // current tutorial page
    }

    export interface IProjectView {
        state: IAppState;
        setState(st: IAppState): void;
        forceUpdate(): void;

        openBlocks(): void;
        openJavaScript(): void;
        openPreviousEditor(): void;

        switchTypeScript(): void;
        openTypeScriptAsync(): Promise<void>;
        saveBlocksToTypeScriptAsync(): Promise<string>;

        saveFileAsync(): Promise<void>;
        loadHeaderAsync(h: pxt.workspace.Header): Promise<void>;
        reloadHeaderAsync(): Promise<void>;
        importProjectAsync(prj: pxt.workspace.Project, filters?: pxt.editor.ProjectFilters): Promise<void>;
        overrideTypescriptFile(text: string): void;

        exportAsync(): Promise<string>;

        newEmptyProject(name?: string, documentation?: string): void;
        newProject(options?: ProjectCreationOptions): void;
        createProjectAsync(options: ProjectCreationOptions): Promise<void>;
        importFileDialog(): void;
        importUrlDialog(): void;
        removeProject(): void;
        editText(): void;

        getPreferredEditor(): string;
        saveAndCompile(): void;
        updateHeaderName(name: string): void;
        compile(): void;

        setFile(fn: IFile): void;
        setSideFile(fn: IFile): void;
        setSideDoc(path: string, blocksEditor?: boolean): void;
        setSideMarkdown(md: string): void;
        removeFile(fn: IFile, skipConfirm?: boolean): void;

        openTutorials(): void;
        setTutorialStep(step: number): void;
        exitTutorial(keep?: boolean): void;
        completeTutorial(): void;
        showTutorialHint(): void;

        anonymousPublishAsync(): Promise<string>;

        startStopSimulator(): void;
        stopSimulator(unload?: boolean): void;
        restartSimulator(): void;
        startSimulator(): void;
        runSimulator(): void;
        expandSimulator(): void;
        collapseSimulator(): void;
        toggleSimulatorCollapse(): void;
        proxySimulatorMessage(content: string): void;
        toggleTrace(): void;

        startTutorial(tutorialId: string): void;

        addPackage(): void;
        typecheckNow(): void;

        fireResize(): void;

        isBlocksEditor(): boolean;
        isTextEditor(): boolean;
        renderBlocksAsync(req: EditorMessageRenderBlocksRequest): Promise<string>;

        // obsolete, may go away
        convertTouchDevelopToTypeScriptAsync(td: string): Promise<string>;

        settings: EditorSettings;

        editor: IEditor;
    }

    export interface IHexFileImporter {
        id: string;
        canImport(data: pxt.cpp.HexFile): boolean;
        importAsync(project: IProjectView, data: pxt.cpp.HexFile): Promise<void>;
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

    }

    export interface ExtensionResult {
        hexFileImporters?: IHexFileImporter[];
        fieldEditors?: IFieldCustomOptions[];
    }

    export let initExtensionsAsync: (opts: ExtensionOptions) => Promise<ExtensionResult>;
}

