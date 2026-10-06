// Match @largeMonitorBreakpoint (1200px): keep the bubble strip horizontal on
// smaller desktops. Visibility defaults use the separate tablet breakpoint.
export const PROJECT_TOOLS_COMPACT_QUERY = "(max-width: 1199px)";
export const PROJECT_TOOLS_LAUNCHER_ID = "project-tools-launcher";
export const PROJECT_TOOLS_PANEL_ID = "project-tools-panel";

export type ProjectToolTab = "docs" | "whiteboard" | "backpack";

export function projectToolTabId(tab: ProjectToolTab): string {
    return `project-tools-tab-${tab}`;
}

export function projectToolPanelId(tab: ProjectToolTab): string {
    return `project-tools-${tab}`;
}

export function isWhiteboardEnabled(): boolean {
    return !!pxt.appTarget?.appTheme?.whiteboard && !!pxt.appTarget.runtime?.palette?.length;
}

export function shouldShowProjectTools(
    sideDocs: boolean,
    inEditor: boolean,
    lockedEditor: boolean,
    temporary: boolean,
    readOnly: boolean,
    enabled: boolean
): boolean {
    return sideDocs && inEditor && !lockedEditor && !temporary && !readOnly && enabled;
}

export function projectToolsPinnedOnLoad(
    state: pxt.editor.IAppState,
    headerId: string,
    opensDocumentation: boolean,
    loadingExample: boolean
): boolean {
    // Homepage examples can open either configured docs or an auto-open README.
    if (opensDocumentation && (state.home || loadingExample)) return true;

    // Reloading the current project (e.g. after an extension change) must not
    // undo the user's choice. Other projects start unpinned unless auto-pinned above.
    return state.header?.id === headerId && !!state.sideDocsPinned;
}