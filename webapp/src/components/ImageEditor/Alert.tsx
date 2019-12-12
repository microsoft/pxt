import * as React from 'react';
import { connect } from 'react-redux';
import { ImageEditorStore } from './store/imageReducer';
import { dispatchHideAlert } from './actions/dispatch';
import { IconButton } from "./Button";

export interface AlertOption {
    label: string;
    onClick: () => void;
}

export interface AlertInfo {
    title: string;
    text: string;
    options?: AlertOption[];
}

interface AlertProps extends AlertInfo {
    dispatchHideAlert: () => void;
}

class AlertImpl extends React.Component<AlertProps, {}> {
    constructor(props: AlertProps) {
        super(props);
    }

    render() {
        const { title, text, options, dispatchHideAlert } = this.props;
        return  <div className="image-editor-alert-container" role="region" onClick={dispatchHideAlert}>
            <div className="image-editor-alert" role="dialog">
                <div className="title">
                    <span className="ms-Icon ms-Icon--Warning"></span>
                    <span>{title}</span>
                    <span className="ms-Icon ms-Icon--Cancel" role="button" onClick={dispatchHideAlert}></span>
                </div>
                <div className="text">{text}</div>
                {options && <div className="options">
                    { options.map(opt => <div className="button" role="button" onClick={opt.onClick}>{opt.label}</div>) }
                </div>}
            </div>
        </div>
    }
}

function mapStateToProps({ editor }: ImageEditorStore, ownProps: any) {
    if (!editor) return {};
    return ownProps;
}

const mapDispatchToProps = {
    dispatchHideAlert
};

export const Alert = connect(mapStateToProps, mapDispatchToProps)(AlertImpl);