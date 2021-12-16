import * as React from "react";
import { Button } from "react-common/controls/Button";

/* eslint-disable import/no-unassigned-import, import/no-internal-modules */
import '../styles/modal.css'
/* eslint-enable import/no-unassigned-import, import/no-internal-modules */

export interface ModalAction {
    label: string;
    className?: string;
    disabled?: boolean;
    icon?: string;
    xicon?: boolean;
    onClick: () => void;
    url?: string;
}

interface ModalProps {
    title: string;
    actions?: ModalAction[];
    className?: string;
    onClose?: () => void;
    fullscreen?: boolean;
}

export class Modal extends React.Component<ModalProps> {
    protected handleModalClick = (e: any) => {
        e.stopPropagation();
    }

    protected handleCloseClick = () => {
        if (this.props.onClose) this.props.onClose();
        this.setState({ visible: false });
    }

    render() {
        const { title, actions, className, fullscreen } = this.props;

        return <div className={`modal-overlay ${fullscreen ? `fullscreen` : ""}`} onClick={this.handleCloseClick} role="region">
            <div className={`modal ${className || ""}`} onClick={this.handleModalClick} role="dialog">
                <div className="modal-header">
                    {fullscreen && <div className="close button" onClick={this.handleCloseClick}>
                        <i className="fas fa-arrow-left" />
                        {lf("Go Back")}
                    </div>}
                    <div className="modal-title">{title}</div>
                    {!fullscreen && <div className="spacer" />}
                    {!fullscreen && <div className="modal-close-icon" onClick={this.handleCloseClick} role="button"><i className="fas fa-times-circle" /></div>}
                </div>
                <div className="modal-body">
                    {this.props.children}
                </div>
                {actions && actions.length > 0 && <div className="modal-actions">
                    {actions.map((el, i) =>
                        <Button
                            className="primary inverted"
                            key={i}
                            disabled={el.disabled}
                            onClick={el.onClick}
                            href={el.url}
                            label={el.label}
                            title={el.label}
                            rightIcon={(el.xicon ? "xicon " : "") + el.icon}
                            />
                    )}
                </div>}
            </div>
        </div>
    }
}
