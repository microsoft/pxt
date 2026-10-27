import * as React from "react";
import type { BackpackDragTargetOptions } from "../../../../pxtblocks/backpackDrag";
import { PROJECT_TOOLS_LAUNCHER_ID, projectToolPanelId, projectToolTabId } from "../../projectToolsState";
import { BackpackEntry, BackpackImportPosition, backpackEntryKey, canDropBackpack } from "./service";

interface BackpackDragOptions {
    headerId: string;
    active: boolean;
    kind: pxt.auth.BackpackKind;
    canImport: boolean;
    modalOpen: boolean;
    isBusy: () => boolean;
    isCurrent: () => boolean;
    onImport: (entry: BackpackEntry, position: BackpackImportPosition) => Promise<void>;
}

interface BackpackDragHandlers {
    startDrag: (event: React.DragEvent<HTMLElement>, entry: BackpackEntry) => void;
    endDrag: () => void;
}

const BACKPACK_DRAG_TYPE = "application/x-makecode-backpack";

export function useBackpackDrag(options: BackpackDragOptions): BackpackDragHandlers {
    const { headerId, active, kind, canImport, modalOpen, isBusy, isCurrent, onImport } = options;
    const dragged = React.useRef<BackpackEntry>();

    const startDrag = (event: React.DragEvent<HTMLElement>, entry: BackpackEntry): void => {
        if (isBusy() || !isCurrent() || !active || modalOpen || !canImport) {
            event.preventDefault();
            return;
        }

        // Do not expose the PNG URI to the project-file drop handler.
        event.dataTransfer.clearData();
        event.dataTransfer.setData(BACKPACK_DRAG_TYPE, backpackEntryKey(entry));
        event.dataTransfer.effectAllowed = "copy";
        dragged.current = entry;
    };

    const endDrag = (): void => {
        dragged.current = undefined;
    };

    React.useEffect(() => {
        if (!active || !canImport || modalOpen) return undefined;

        const onDrag = (event: DragEvent): void => {
            if (!dragged.current || !event.dataTransfer?.types.includes(BACKPACK_DRAG_TYPE)) return;

            event.preventDefault();
            event.stopPropagation();

            const entryKind = dragged.current.summary?.kind || dragged.current.item?.kind || "code";
            const allowed = !isBusy() && isCurrent() && canDropBackpack(headerId, event.target, entryKind);
            event.dataTransfer.dropEffect = allowed ? "copy" : "none";
            if (event.type !== "drop") return;

            const entry = dragged.current;
            dragged.current = undefined;
            if (allowed && event.dataTransfer.getData(BACKPACK_DRAG_TYPE) === backpackEntryKey(entry)) {
                void onImport(entry, { x: event.clientX, y: event.clientY });
            }
        };

        document.addEventListener("dragover", onDrag, true);
        document.addEventListener("drop", onDrag, true);

        return () => {
            dragged.current = undefined;
            document.removeEventListener("dragover", onDrag, true);
            document.removeEventListener("drop", onDrag, true);
        };
    }, [active, headerId, canImport, modalOpen, kind]);

    return { startDrag, endDrag };
}

export const BACKPACK_DRAG_OVER_CLASS = "project-backpack-drag-over";

function visibleElement(id: string): HTMLElement | undefined {
    const element = document.getElementById(id);
    if (!element || !element.isConnected || !element.getClientRects().length) return undefined;

    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    if (style.visibility === "hidden" || style.visibility === "collapse" || style.display === "none") return undefined;

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? element : undefined;
}

/** Resolve visible drop targets each time Blockly checks their positions. */
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
