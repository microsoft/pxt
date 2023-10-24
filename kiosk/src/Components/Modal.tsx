import * as React from "react";
import * as ReactDOM from "react-dom";
import { classList } from "../Utils";
import GenericButton from "./GenericButton";
import { ControlProps } from "../Types/Ui";
import { useOnControlPress } from "../Hooks";
import * as NavGrid from "../Services/NavGrid";
import * as GamepadManager from "../Services/GamepadManager";

export interface ModalAction {
    label: string;
    className?: string;
    disabled?: boolean;
    onClick: () => void;
    url?: string;
    autofocus?: boolean;
}

export interface ModalProps extends React.PropsWithChildren<ControlProps> {
    title: string;
    helpUrl?: string;
    actions?: ModalAction[];
    onClose?: () => void;
    parentElement?: Element;
}

export const Modal = (props: ModalProps) => {
    const { children, id, className, title, actions, parentElement, onClose } =
        props;

    React.useEffect(() => {
        NavGrid.pushContext();
        return () => NavGrid.popContext();
    }, []);

    useOnControlPress(
        [],
        () => {
            onClose?.();
        },
        GamepadManager.GamepadControl.BackButton
    );

    const classes = classList("common-modal-container", className);

    return ReactDOM.createPortal(
        <div className={classes}>
            <div id={id} className="common-modal" role="dialog">
                <div className="common-modal-header">
                    <div id="modal-title" className="common-modal-title">
                        {title}
                    </div>
                </div>
                <div className="common-modal-body">{children}</div>
                {actions?.length && (
                    <div className="common-modal-footer">
                        {actions.map((action, index) => (
                            <GenericButton
                                title={action.label}
                                label={action.label}
                                key={index}
                                onClick={action.onClick}
                                autofocus={action.autofocus}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>,
        parentElement || document.getElementById("root") || document.body
    );
};
