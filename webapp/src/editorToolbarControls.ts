/** What decides the editing controls of the editor toolbar. */
export interface EditorToolbarControlsInput {
    /** The editor is read-only. */
    readOnly: boolean;
    /** The debugger is running. */
    debugging: boolean;
    /** A tutorial shows zoom and undo above the workspace instead (its legacy flyoutOnly flag). */
    hideZoomAndUndo: boolean;
    /** A tutorial hides the toolbox. */
    hideToolbox: boolean;
    /** The active editor has undo, redo and zoom on the toolbar (its hasEditorToolbarEditingControls). */
    editorHasEditingControls: boolean;
}

/** The editing controls the editor toolbar shows. */
export interface EditorToolbarControls {
    /** True if the undo and redo buttons are shown. */
    showUndoRedo: boolean;
    /** True if the zoom buttons are shown. */
    showZoomControls: boolean;
}

/** Returns the editing controls the editor toolbar shows for `input`. */
export function getEditorToolbarControls(input: EditorToolbarControlsInput): EditorToolbarControls {
    const { readOnly, debugging, hideZoomAndUndo, hideToolbox, editorHasEditingControls } = input;
    return {
        showUndoRedo: editorHasEditingControls && !readOnly && !debugging && !hideZoomAndUndo && !hideToolbox,
        showZoomControls: editorHasEditingControls && !hideZoomAndUndo && !hideToolbox,
    };
}
