export interface IAppState {
    active?: boolean; // is this tab visible at all
    greenScreen?: boolean;
    collapseEditorTools?: boolean;

    header?: pxt.workspace.Header;
    editorState?: pxt.editor.EditorState;
    fileState?: string;
    currFile?: pxt.editor.IFile;
    projectName?: string;

    // is the file explorer expanded?
    showFiles?: boolean;

    // is the flyout open? sorta
    hideEditorFloats?: boolean;

    showMiniSim?: boolean;
    autoRun?: boolean;

    lightbox?: boolean;
    home?: boolean;

    sideDocsLoadUrl?: string; // set once to load the side docs frame
    sideDocsCollapsed?: boolean;


    tutorialOptions?: pxt.tutorial.TutorialOptions;

    embedSimView?: boolean;
    simState?: pxt.editor.SimState;


    debugging?: boolean;
    tracing?: boolean;

    bannerVisible?: boolean;

    editorOffset?: string;
    accessibleBlocks?: boolean;
    errorListState?: pxt.editor.ErrorListState;
    onboarding?: pxt.tour.BubbleStep[];

    // tracks the state of the tutorial hint reminder animation
    pokeUserComponent?: string;

    // did the last compile operation detect multiplayer APIs in the code (arcade)?
    isMultiplayerGame?: boolean;

    // did the last compile operation detect parts?
    showParts?: boolean;

    // if true, a critical error has occurred in the webapp and we will reload
    hasError?: boolean;

    // is the extension modal visible?
    extensionsVisible?: boolean;


    // ==========================================================
    // simulator state
    // ==========================================================

    // are we showing the keyboard controls (arcade)?
    keymap?: boolean;

    // is the simulator fullscreen?
    fullscreen?: boolean;

    // is the simulator muted?
    mute?: pxt.editor.MuteState;

    // did we receive serial messages from the simulator?
    simSerialActive?: boolean;

    // did we receive serial messages from the device?
    deviceSerialActive?: boolean;

    // ==========================================================
    // pending async operation state
    // ==========================================================

    // are we waiting on the response of a sim screenshot request?
    screenshoting?: boolean;

    // is the project being saved for a download?
    isSaving?: boolean;

    // is the project currently being compiled?
    compiling?: boolean;

    // are we waiting on the response of a share request?
    publishing?: boolean;

    // did the pending download operation get cancelled?
    cancelledDownload?: boolean;

    // ==========================================================
    // temporary state - state that is cleared after being read once
    // ==========================================================

    // make sure debugger stops on the first statement
    debugFirstRun?: boolean;

    // ensure that this line is visible when loading the editor
    editorPosition?: {
        lineNumber: number;
        column: number;
        file: pxt.editor.IFile;
    };

    // used to make sure we only show package conflicts when a project compiles for the first time
    suppressPackageWarning?: boolean;

    // used to restart sim that has been stopped because the tab lost focus
    resumeOnVisibility?: boolean;


    // ==========================================================
    // unused
    // ==========================================================

    print?: boolean;
    flashHint?: boolean;
    showBlocks?: boolean;
}