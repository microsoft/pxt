import React = require("react");
import ReactDOM = require("react-dom");
import { classList, ContainerProps } from "../util";
import { Button } from "./Button";
import { FocusTrap } from "./FocusTrap";

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
    helpUrl?: string
    ariaDescribedBy?: string;
    actions?: ModalAction[];
    onClose?: () => void;
    fullscreen?: boolean;
    parentElement?: Element;
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
        helpUrl,
        actions,
        onClose,
        parentElement,
        fullscreen
    } = props;

    const closeClickHandler = (e?: React.MouseEvent<HTMLButtonElement>) => {
        if (onClose) onClose();
    }

    const classes = classList(
        "common-modal-container",
        fullscreen && "fullscreen",
        className
    );

    return ReactDOM.createPortal(<FocusTrap className={classes} onEscape={closeClickHandler}>
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
                            key={"back-button"}
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
                {fullscreen && helpUrl &&
                    <div className="common-modal-help">
                        <Button
                            className={"menu-button"}
                            title={lf("Help on {0} dialog", title)}
                            onClick={() => { window.open(props.helpUrl, "_blank") }}
                            rightIcon={"icon help"}
                        />
                    </div>
                }
                {!fullscreen &&
                    <div className="common-modal-close">
                        <Button
                            key={"close-button"}
                            className="menu-button inverted"
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
    </FocusTrap>, parentElement || document.body)
}