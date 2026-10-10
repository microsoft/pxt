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

// PR NOTE [Issue 6] -- lift into the PR description, then remove.
// The toolbar's undo, redo and zoom decision, moved here unchanged from
// EditorToolbar.renderCore so it can be tested without a DOM, with one new
// input: an editor that has none of these controls, such as a simulator
// extension editor tab, shows the toolbar without them.
/** Returns the editing controls the editor toolbar shows for `input`. */
export function getEditorToolbarControls(input: EditorToolbarControlsInput): EditorToolbarControls {
    const { readOnly, debugging, hideZoomAndUndo, hideToolbox, editorHasEditingControls } = input;
    return {
        showUndoRedo: editorHasEditingControls && !readOnly && !debugging && !hideZoomAndUndo && !hideToolbox,
        showZoomControls: editorHasEditingControls && !hideZoomAndUndo && !hideToolbox,
    };
}
