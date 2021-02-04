import * as React from "react";
import * as sui from "./sui";
import * as pkg from "./package";
import * as workspace from "./workspace";

interface CloudSyncButtonProps extends pxt.editor.ISettingsProps {
    className?: string;
}

interface CloudSyncButtonState {
    pushPulling?: boolean;
}

export class CloudSyncButton extends sui.UIElement<CloudSyncButtonProps, CloudSyncButtonState> {
    constructor(props: CloudSyncButtonProps) {
        super(props);
        this.state = {};
        this.handleClick = this.handleClick.bind(this);
        this.handleButtonKeydown = this.handleButtonKeydown.bind(this);
    }

    private handleButtonKeydown(e: React.KeyboardEvent<HTMLElement>) {
        e.stopPropagation();
    }

    private handleClick(e: React.MouseEvent<HTMLElement>) {
        e.stopPropagation();

        console.log("CLICK!") // TODO
    }

    renderCore() {
        const defaultCls = "ui icon button editortools-btn editortools-cloudsync-btn"

        const title = "TODO";

        return <div key="cloudsynceditorbtn" role="button" className={`${defaultCls}
            ${this.props.className || ""}`}
            title={title} onClick={this.handleClick}>
            <i className="cloud icon" />
            {/* TODO */}
            {/* <span className="ui mobile hide">{displayName}</span> */}
            {/* <i className={`ui long check icon mobile hide`} /> */}
        </div>;
    }
}
