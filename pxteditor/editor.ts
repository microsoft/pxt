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

    export interface TutorialOptions {
        tutorial?: string; // tutorial
        tutorialName?: string; // tutorial title
        tutorialSteps?: string[]; // tutorial steps
        tutorialStep?: number; // current tutorial page
        tutorialReady?: boolean; // current tutorial page
        tutorialHeaderContent?: string; // current tutorial header content
        tutorialHint?: string; // current tutorial content, shown in hints
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
        saveBlocksToTypeScript(): string;

        saveFileAsync(): Promise<void>;
        loadHeaderAsync(h: pxt.workspace.Header): Promise<void>;
        reloadHeaderAsync(): Promise<void>;
        importProjectAsync(prj: pxt.workspace.Project, filters?: pxt.editor.ProjectFilters): Promise<void>;

        exportAsync(): Promise<string>;

        newEmptyProject(name?: string, documentation?: string): void;
        newProject(options?: ProjectCreationOptions): void;
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
        setSideDoc(path: string): void;
        setSideMarkdown(md: string): void;
        removeFile(fn: IFile, skipConfirm?: boolean): void;

        setTutorialStep(step: number): void;
        exitTutorial(): void;
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

        startTutorial(tutorialId: string): void;

        addPackage(): void;
        typecheckNow(): void;

        fireResize(): void;

        isBlocksEditor(): boolean;
        isTextEditor(): boolean;

        settings: EditorSettings;

        editor: IEditor;
    }

    export interface ISettingsProps {
        parent: IProjectView;
        visible?: boolean;
    }
}

