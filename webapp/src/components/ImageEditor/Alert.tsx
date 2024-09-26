import * as React from 'react';
import { hideAlert, ImageEditorContext } from './state';

export interface AlertOption {
    label: string;
    onClick: () => void;
}

export interface AlertInfo {
    title: string;
    text: string;
    options?: AlertOption[];
}

export const Alert = (props: AlertInfo) => {
    const { title, text, options } = props;

    const { dispatch } = React.useContext(ImageEditorContext);

    const onCloseClick = () => {
        dispatch(hideAlert());
    }

    return (
        <div className="image-editor-alert-container" role="region" onClick={onCloseClick}>
            <div className="image-editor-alert" role="dialog">
                <div className="title">
                    <span className="ms-Icon ms-Icon--Warning"></span>
                    <span>{title}</span>
                    <span className="ms-Icon ms-Icon--Cancel" role="button" onClick={onCloseClick}></span>
                </div>
                <div className="text">{text}</div>
                {options && <div className="options">
                    { options.map((opt, index) => <div key={index} className="button" role="button" onClick={opt.onClick}>{opt.label}</div>) }
                </div>}
            </div>
        </div>
    );
}