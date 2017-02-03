
type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;
type InstallHeader = pxt.workspace.InstallHeader;

declare namespace pxt.editor {

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
    header?: Header;
    currFile?: pkg.File;
    fileState?: string;
    showFiles?: boolean;
    sideDocsLoadUrl?: string; // set once to load the side docs frame
    sideDocsCollapsed?: boolean;
    projectName?: string;

    tutorial?: string; // tutorial
    tutorialName?: string; // tutorial title
    tutorialSteps?: string[]; // tutorial steps
    tutorialStep?: number; // current tutorial page
    tutorialReady?: boolean; // current tutorial page
    tutorialUrl?: string; // current tutorial url
    tutorialCardLocation?: string; // current card location

    running?: boolean;
    compiling?: boolean;
    publishing?: boolean;
    hideEditorFloats?: boolean;
    collapseEditorTools?: boolean;
    showBlocks?: boolean;
    showParts?: boolean;
    fullscreen?: boolean;
    mute?: boolean;
}

export interface ProjectCreationOptions {
    prj?: pxt.ProjectTemplate;
    name?: string;
    documentation?: string;
    filesOverride?: pxt.Map<string>;
    temporary?: boolean;
}

export interface IProjectView {
    state: IAppState;
    setState(st: IAppState): void;
    forceUpdate(): void;

    switchTypeScript(): void;
    openTypeScriptAsync(): Promise<void>;

    saveFileAsync(): Promise<void>;
    loadHeaderAsync(h: Header): Promise<void>;
    reloadHeaderAsync(): Promise<void>;

    exportAsync(): Promise<string>;

    newEmptyProject(name?: string, documentation?: string): void;
    newProject(options?: ProjectCreationOptions): void;
    importFileDialog(): void;

    getPreferredEditor(): string;
    saveAndCompile(): void;
    updateHeaderName(name: string): void;
    compile(): void;

    setFile(fn: pkg.File): void;
    setSideFile(fn: pkg.File): void;
    setSideDoc(path: string): void;
    removeFile(fn: pkg.File, skipConfirm?: boolean): void;

    setTutorialStep(step: number): void;
    exitTutorial(): void;

    publishAsync(): Promise<string>;

    startStopSimulator(): void;
    restartSimulator(): void;
    startSimulator(): void;

    addPackage(): void;

    fireResize(): void;

    isBlocksEditor(): boolean;
    isTextEditor(): boolean;
    editor: srceditor.Editor;
}

export interface ISettingsProps {
    parent: IProjectView;
    visible?: boolean;
}
}

