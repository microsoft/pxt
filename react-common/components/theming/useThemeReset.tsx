import * as React from "react";
import { Modal, ModalAction } from "../controls/Modal";

/** Shared confirmation for editor-wide pickers, not project-specific theme settings. */
export function useThemeReset(pickerId: string, onReset: (() => Promise<void>) | undefined) {
    const [confirming, setConfirming] = React.useState(false);
    const [resetting, setResetting] = React.useState(false);
    const [failed, setFailed] = React.useState(false);
    const inFlight = React.useRef(false);
    const restoreFocus = React.useRef(false);

    React.useEffect(() => {
        if (!confirming && restoreFocus.current) {
            document.getElementById(pickerId)?.querySelector<HTMLElement>(".theme-reset-button")?.focus();
            restoreFocus.current = false;
        }
    }, [confirming, pickerId]);

    const cancel = () => {
        if (inFlight.current) return;
        restoreFocus.current = true;
        setConfirming(false);
    };

    const confirm = async () => {
        if (!onReset || inFlight.current) return;
        inFlight.current = true;
        setResetting(true);
        setFailed(false);
        try {
            await onReset();
        } catch (error) {
            pxt.reportException(error);
            setFailed(true);
        } finally {
            inFlight.current = false;
            setResetting(false);
        }
    };

    const resetAction: ModalAction | undefined = onReset ? {
        label: lf("Reset"),
        className: "primary inverted theme-reset-button",
        onClick: () => {
            setFailed(false);
            setConfirming(true);
        },
    } : undefined;

    const confirmation = confirming && <Modal
        key="theme-reset-confirmation"
        title={lf("Reset all themes?")}
        ariaDescribedBy="theme-reset-description"
        onClose={cancel}
        hideDismissButton={resetting}
        actions={[
            { label: lf("Cancel"), onClick: cancel, disabled: resetting },
            { label: resetting ? lf("Resetting...") : lf("Reset"), className: "primary", onClick: confirm, disabled: resetting },
        ]}>
        <p id="theme-reset-description">
            {lf("Are you sure you want to reset the editor and simulator themes to their defaults? This will remove your editor-wide theme customizations. Themes set directly on projects will not be changed. This action cannot be undone.")}
        </p>
        {failed && <p role="alert">{lf("Unable to reset themes. Please try again.")}</p>}
    </Modal>;

    return { resetAction, confirmation };
}