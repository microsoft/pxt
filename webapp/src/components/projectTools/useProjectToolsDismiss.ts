import * as React from "react";

interface ProjectToolsDismissOptions {
    expanded: boolean;
    optionsOpen: boolean;
    compact: boolean;
    docsUrl?: string;
    docsRequest?: number;
    onDismiss: () => void;
}

export function useProjectToolsDismiss(
    root: React.RefObject<HTMLDivElement>,
    options: ProjectToolsDismissOptions
): React.FocusEventHandler<HTMLDivElement> {
    const { expanded, optionsOpen, compact, docsUrl, docsRequest, onDismiss } = options;

    React.useEffect(() => {
        if (!expanded && !optionsOpen) return undefined;

        const onPointerDown = (event: PointerEvent): void => {
            if (root.current && !root.current.contains(event.target as Node)) {
                onDismiss();
            }
        };

        let frame: number;
        const onWindowBlur = (): void => {
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
            window.removeEventListener("blur", onWindowBlur);
            removeFrameListeners.forEach(remove => remove());
            if (frame !== undefined) window.cancelAnimationFrame(frame);
        };
    }, [compact, optionsOpen, expanded, docsUrl, docsRequest, onDismiss]);

    return event => {
        if (event.relatedTarget) {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) onDismiss();
        } else {
            // Focus entering an iframe can leave relatedTarget null.
            window.requestAnimationFrame(() => {
                if (root.current && !root.current.contains(document.activeElement)) onDismiss();
            });
        }
    };
}
