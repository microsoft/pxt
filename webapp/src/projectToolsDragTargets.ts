import type { BackpackDragTargetOptions } from "../../pxtblocks/backpack";
import { PROJECT_TOOLS_LAUNCHER_ID, projectToolPanelId, projectToolTabId } from "./projectToolsState";

export const BACKPACK_DRAG_OVER_CLASS = "project-backpack--drag-over";

function visibleElement(id: string): HTMLElement | undefined {
    const element = document.getElementById(id);
    if (!element || !element.isConnected || !element.getClientRects().length) return undefined;
    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    if (style.visibility === "hidden" || style.visibility === "collapse" || style.display === "none") return undefined;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? element : undefined;
}

/** Keep project-tools DOM ownership out of the workspace-scoped Blockly integration. */
export function getBackpackDragTargets(): BackpackDragTargetOptions[] {
    const tab = (): HTMLElement | undefined => visibleElement(projectToolTabId("backpack"));

    return [
        { getElement: tab, openOnHover: true },
        { getElement: () => visibleElement(projectToolPanelId("backpack")) },
        {
            getElement: () => tab() ? undefined : visibleElement(PROJECT_TOOLS_LAUNCHER_ID),
            openOnHover: true
        }
    ];
}
