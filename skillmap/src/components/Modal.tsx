import * as React from "react";

/* eslint-disable import/no-unassigned-import, import/no-internal-modules */
import '../styles/modal.css'
/* eslint-enable import/no-unassigned-import, import/no-internal-modules */

export interface ModalAction {
    label: string;
    className?: string;
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
        const  { title, actions, className, fullscreen } = this.props;

        return <div className={`modal-overlay ${className || ""} ${fullscreen && `fullscreen`}`} onClick={this.handleCloseClick} role="region">
            <div className="modal" onClick={this.handleModalClick} role="dialog">
                <div className="modal-header">
                    {fullscreen && <div className="close button" onClick={this.handleCloseClick}>
                        <i className="icon arrow left"/>
                        {lf("Go Back")}
                    </div>}
                    <div className="modal-title">{title}</div>
                    {!fullscreen && <div className="spacer" />}
                    {!fullscreen && <div className="modal-close-icon" onClick={this.handleCloseClick} role="button"><i className="icon close"/></div>}
                </div>
                <div className="modal-body">
                    { this.props.children }
                </div>
                {actions && actions.length > 0 && <div className="modal-actions">
                    {actions.map((el, i) => {
                        return el.url
                            ? <a key={i} className={`modal-button ${el.className || ""}`} href={el.url} onClick={el.onClick} target="_blank" rel="noopener noreferrer" role="button">{el.label}</a>
                            : <div key={i} className={`modal-button ${el.className || ""}`} onClick={el.onClick} role="button">{el.label}</div>
                    })}
                </div>}
            </div>
        </div>
    }
}
