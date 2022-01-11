import React = require("react");
import { classList, ContainerProps } from "../util";
import { Button } from "./Button";

export interface ModalAction {
    label: string;
    className?: string;
    disabled?: boolean;
    icon?: string;
    xicon?: boolean;
    onClick: () => void;
    url?: string;

    // TODO: It would be nice to make fullscreen modals their own thing and deprecate this prop. right
    // now it's required to render the back arrow
    fullscreen?: boolean;
}

export interface ModalProps extends ContainerProps {
    title: string;
    ariaDescribedBy?: string;
    actions?: ModalAction[];
    onClose?: () => void;
    fullscreen?: boolean;
}

export const Modal = (props: ModalProps) => {
    const {
        children,
        id,
        className,
        ariaLabel,
        ariaHidden,
        ariaDescribedBy,
        role,
        title,
        actions,
        onClose,
        fullscreen
    } = props;

    const closeClickHandler = (e?: React.MouseEvent<HTMLButtonElement>) => {
        if (onClose) onClose();
    }

    let firstFocusableElement: HTMLElement;
    let lastFocusableElement: HTMLElement;

    const handleRef = (ref: HTMLDivElement) => {
        if (!ref) return;

        const focusable = ref.querySelectorAll(`[tabindex]:not([tabindex="-1"])`);

        firstFocusableElement = focusable.item(0) as HTMLElement;
        lastFocusableElement = focusable.item(focusable.length - 1) as HTMLElement;

        // TODO: Add an error here? this should never happen
        if (!firstFocusableElement) return;

        if (!ref.contains(document.activeElement)) firstFocusableElement.focus();
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key !== "Tab") return;

        const target = e.target;

        if (e.shiftKey) {
            if (target === firstFocusableElement) {
                lastFocusableElement.focus();
                e.preventDefault();
                e.stopPropagation();
            }
        }
        else if (target === lastFocusableElement) {
            firstFocusableElement.focus();
            e.preventDefault();
            e.stopPropagation();
        }
    }

    const classes = classList(
        "common-modal-container",
        fullscreen && "fullscreen",
        className
    );

    return <div className={classes} ref={handleRef} onKeyDown={onKeyDown}>
        <div id={id}
            className="common-modal"
            role={role || "dialog"}
            aria-hidden={ariaHidden}
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            aria-labelledby="modal-title">
            <div className="common-modal-header">
                {fullscreen &&
                    <div className="common-modal-back">
                        <Button
                            className="menu-button"
                            onClick={closeClickHandler}
                            title={lf("Go Back")}
                            label={lf("Go Back")}
                            leftIcon="fas fa-arrow-left"
                        />
                    </div>
                }
                <div id="modal-title" className="common-modal-title">
                    {title}
                </div>
                {!fullscreen &&
                    <div className="common-modal-close">
                        <Button
                            className="menu-button"
                            onClick={closeClickHandler}
                            title={lf("Close")}
                            rightIcon="fas fa-times-circle"
                        />
                    </div>
                }
            </div>
            <div className="common-modal-body">
                {children}
            </div>
            {actions?.length &&
                <div className="common-modal-footer">
                    { actions.map((action, index) =>
                        <Button
                            key={index}
                            className="primary inverted"
                            disabled={action.disabled}
                            onClick={action.onClick}
                            href={action.url}
                            label={action.label}
                            title={action.label}
                            rightIcon={(action.xicon ? "xicon " : "") + action.icon}
                        />
                    )}
                </div>
            }
        </div>
    </div>
}