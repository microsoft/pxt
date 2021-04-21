import * as React from "react";

/* eslint-disable import/no-unassigned-import, import/no-internal-modules */
import '../styles/modal.css'
/* eslint-enable import/no-unassigned-import, import/no-internal-modules */

export interface ModalAction {
    label: string;
    className?: string;
    onClick: () => void;
}

interface ModalProps {
    title: string;
    actions?: ModalAction[];
    className?: string;
    onClose?: () => void;
}

export class Modal extends React.Component<ModalProps> {
    protected handleModalClick = (e: any) => {
        e.stopPropagation();
        e.preventDefault();
    }

    protected handleCloseClick = () => {
        if (this.props.onClose) this.props.onClose();
        this.setState({ visible: false });
    }

    render() {
        const  { title, actions, className } = this.props;
        return <div className="modal-overlay" onClick={this.handleCloseClick} role="region">
            <div className={`modal ${className || ""}`} onClick={this.handleModalClick} role="dialog">
                <div className="modal-header">
                    <div className="modal-title">{title}</div>
                    <div className="spacer" />
                    <div className="modal-close-icon" onClick={this.handleCloseClick} role="button"><i className="icon close"/></div>
                </div>
                <div className="modal-body">
                    { this.props.children }
                </div>
                {actions && actions.length > 0 && <div className="modal-actions">
                    {actions.map((el, i) => {
                        return <div key={i} className={`modal-button ${el.className || ""}`} onClick={el.onClick} role="button">{el.label}</div>
                    })}
                </div>}
            </div>
        </div>
    }
}
