import * as React from "react";

export function useBackpackPageFocus(isCurrent: () => boolean, onPageReturn: () => void): void {
    React.useEffect(() => {
        let away = document.hidden;
        let blurTimer: number;
        let focusedFrame: HTMLIFrameElement;
        let frameWindow: Window;

        const detachFrameWindow = (): void => {
            try {
                frameWindow?.removeEventListener("blur", onBlur);
                frameWindow?.removeEventListener("focus", onReturn);
            } catch {
                // The frame may have navigated to another origin.
            }
            frameWindow = undefined;
        };

        const attachFrameWindow = (): void => {
            detachFrameWindow();
            try {
                frameWindow = focusedFrame?.contentWindow;
                frameWindow?.addEventListener("blur", onBlur);
                frameWindow?.addEventListener("focus", onReturn);
            } catch {
                // Cross-origin frames still use visibilitychange.
                frameWindow = undefined;
            }
        };

        const onBlur = (): void => {
            window.clearTimeout(blurTimer);
            blurTimer = window.setTimeout(() => {
                // Moving into the simulator/docs iframe is not leaving the page.
                if (!document.hasFocus()) away = true;

                const frame = document.activeElement instanceof HTMLIFrameElement
                    ? document.activeElement
                    : undefined;
                if (frame !== focusedFrame) {
                    focusedFrame?.removeEventListener("load", attachFrameWindow);
                    focusedFrame = frame;
                    focusedFrame?.addEventListener("load", attachFrameWindow);
                    attachFrameWindow();
                }
            }, 0);
        };

        const onReturn = (): void => {
            if (document.hidden) {
                away = true;
                return;
            }
            if (!away || !isCurrent()) return;

            away = false;
            onPageReturn();
        };

        document.addEventListener("visibilitychange", onReturn);
        window.addEventListener("blur", onBlur);
        window.addEventListener("focus", onReturn);
        onBlur();

        return () => {
            window.clearTimeout(blurTimer);
            focusedFrame?.removeEventListener("load", attachFrameWindow);
            detachFrameWindow();
            document.removeEventListener("visibilitychange", onReturn);
            window.removeEventListener("blur", onBlur);
            window.removeEventListener("focus", onReturn);
        };
    }, []);
}
