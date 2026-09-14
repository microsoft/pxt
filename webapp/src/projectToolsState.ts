/** Keep project-load defaults separate from explicit pin/unpin and collapse actions. */
export function projectToolsPinnedOnLoad(state: pxt.editor.IAppState, headerId: string, opensDocumentation: boolean, loadingExample: boolean): boolean {
    // Homepage examples can open either configured docs or an auto-open README.
    if (opensDocumentation && (state.home || loadingExample)) return true;
    // Reloading the current project (e.g. after an extension change) must not
    // undo the user's choice. Other projects start unpinned unless auto-pinned above.
    return state.header?.id === headerId && !!state.sideDocsPinned;
}