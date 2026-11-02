import * as React from "react";
import * as Blockly from "blockly";

interface ProjectToolsDismissOptions {
    expanded: boolean;
    optionsOpen: boolean;
    compact: boolean;
    keepOpenOnBlockDrag?: boolean;
    docsUrl?: string;
    docsRequest?: number;
    onDismiss: () => void;
}

export function useProjectToolsDismiss(
    root: React.RefObject<HTMLDivElement>,
    options: ProjectToolsDismissOptions
): React.FocusEventHandler<HTMLDivElement> {
    const { expanded, optionsOpen, compact, docsUrl, docsRequest, onDismiss } = options;
    const keepOpenOnBlockDrag = expanded && options.keepOpenOnBlockDrag;
    const blockPointer = React.useRef<{ id: number; workspace: Blockly.WorkspaceSvg }>();

    React.useEffect(() => {
        if (!keepOpenOnBlockDrag) blockPointer.current = undefined;
        if (!expanded && !optionsOpen) return undefined;

        const onPointerDown = (event: PointerEvent): void => {
            if (blockPointer.current && !event.isPrimary) return;
            blockPointer.current = undefined;
            if (root.current && !root.current.contains(event.target as Node)) {
                if (keepOpenOnBlockDrag && event.button === 0 && event.isPrimary && event.target instanceof Element) {
                    const element = event.target.closest("[data-id]");
                    const id = element?.getAttribute("data-id");
                    if (id) {
                        for (const workspace of Blockly.Workspace.getAll()) {
                            const block = workspace.getBlockById(id);
                            if (block instanceof Blockly.BlockSvg && block.getSvgRoot() === element) {
                                blockPointer.current = { id: event.pointerId,
                                    workspace: block.workspace.targetWorkspace || block.workspace };
                                return;
                            }
                        }
                    }
                }
                onDismiss();
            }
        };

        const onPointerEnd = (event: PointerEvent): void => {
            const pointer = blockPointer.current;
            if (!pointer || pointer.id !== event.pointerId) return;

            blockPointer.current = undefined;
            // Capture runs before Blockly ends the gesture, so its drag state is still available.
            if (!pointer.workspace.isDragging()) onDismiss();
        };

        let frame: number;
        const onWindowBlur = (): void => {
            blockPointer.current = undefined;
            if (frame !== undefined) window.cancelAnimationFrame(frame);

            frame = window.requestAnimationFrame(() => {
                frame = undefined;
                const active = document.activeElement;
                // Clicks inside an iframe do not bubble to this document.
                if (root.current && active instanceof HTMLIFrameElement && !root.current.contains(active)) {
                    onDismiss();
                }
            });
        };

        // Listen before Blockly or Monaco can stop the event from bubbling.
        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("pointerup", onPointerEnd, true);
        document.addEventListener("pointercancel", onPointerEnd, true);
        window.addEventListener("blur", onWindowBlur);

        // Switching between iframes may only blur the old frame's window.
        const removeFrameListeners = Array.from(root.current?.querySelectorAll("iframe") || []).map(iframe => {
            let frameWindow: Window;
            const detach = (): void => {
                try {
                    frameWindow?.removeEventListener("blur", onWindowBlur);
                } catch {
                    // The frame may have navigated to another origin.
                }
                frameWindow = undefined;
            };

            const attach = (): void => {
                detach();
                try {
                    frameWindow = iframe.contentWindow;
                    frameWindow?.addEventListener("blur", onWindowBlur);
                } catch {
                    // Cross-origin frames still use the parent window's listener.
                    frameWindow = undefined;
                }
            };

            iframe.addEventListener("load", attach);
            attach();

            return () => {
                iframe.removeEventListener("load", attach);
                detach();
            };
        });

        return () => {
            document.removeEventListener("pointerdown", onPointerDown, true);
            document.removeEventListener("pointerup", onPointerEnd, true);
            document.removeEventListener("pointercancel", onPointerEnd, true);
            window.removeEventListener("blur", onWindowBlur);
            removeFrameListeners.forEach(remove => remove());
            if (frame !== undefined) window.cancelAnimationFrame(frame);
        };
    }, [compact, optionsOpen, expanded, docsUrl, docsRequest, onDismiss, keepOpenOnBlockDrag]);

    return event => {
        if (blockPointer.current) return;

        if (event.relatedTarget) {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) onDismiss();
        } else {
            // Focus entering an iframe can leave relatedTarget null.
            window.requestAnimationFrame(() => {
                if (!blockPointer.current && root.current && !root.current.contains(document.activeElement)) onDismiss();
            });
        }
    };
}
