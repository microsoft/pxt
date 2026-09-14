// Match @largeMonitorBreakpoint (1200px): keep the bubble strip horizontal on
// smaller desktops without changing the editor's separate tablet breakpoint.
export const PROJECT_TOOLS_COMPACT_QUERY = "(max-width: 1199px)";

/** Keep project-load defaults separate from explicit pin/unpin and collapse actions. */
export function projectToolsPinnedOnLoad(state: pxt.editor.IAppState, headerId: string, opensDocumentation: boolean, loadingExample: boolean): boolean {
    // Homepage examples can open either configured docs or an auto-open README.
    if (opensDocumentation && (state.home || loadingExample)) return true;
    // Reloading the current project (e.g. after an extension change) must not
    // undo the user's choice. Other projects start unpinned unless auto-pinned above.
    return state.header?.id === headerId && !!state.sideDocsPinned;
}