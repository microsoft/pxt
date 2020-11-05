import * as React from "react";

import '../styles/modal.css'

export interface ModalAction {
    label: string;
    className?: string;
    onClick: () => void;
}

interface ModalProps {
    title: string;
    actions?: ModalAction[];
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
        const  { title, actions } = this.props;
        return <div className="modal-overlay" onClick={this.handleCloseClick}>
            <div className="modal" onClick={this.handleModalClick}>
                <div className="modal-header">
                    <div className="modal-title">{title}</div>
                    <div className="spacer" />
                    <div className="modal-close-icon" onClick={this.handleCloseClick}><i className="icon close"/></div>
                </div>
                <div className="modal-body">
                    { this.props.children }
                </div>
                {actions && actions.length > 0 && <div className="modal-actions">
                    {actions.map((el, i) => {
                        return <div key={i} className={`modal-button ${el.className}`} onClick={el.onClick}>{el.label}</div>
                    })}
                </div>}
            </div>
        </div>
    }
}
