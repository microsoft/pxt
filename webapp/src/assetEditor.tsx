/// <reference path="../../built/pxtlib.d.ts"/>

import * as React from "react";
import * as ReactDOM from "react-dom";

import { ImageFieldEditor } from "./components/ImageFieldEditor";
import { FieldEditorComponent } from "./blocklyFieldView";

document.addEventListener("DOMContentLoaded", () => {
    init();
})

function init() {
    const assetDiv = document.getElementById("asset-editor-field-div") as HTMLDivElement;
    ReactDOM.render(<AssetEditor />, assetDiv);
}
export interface Message {
    data: MessageData;
}
export interface MessageData {
    type: string;
    message?: string;
    _fromVscode?: boolean;
}

export class AssetEditor extends React.Component {
    private editor: FieldEditorComponent<any>;
    private currentJres: string;

    handleMessage = (msg: Message)  => {
        if (msg.data._fromVscode) {
            if (msg.data.type === "initialize") {
                this.editor.loadJres(msg.data.message);
                this.currentJres = msg.data.message;
            } else if (msg.data.type === "update") {
                this.updateAndSendJres();
            } else if (msg.data.type === 'updateWebview') {
                this.editor.loadJres(this.currentJres);
            }
        }
    }

    refHandler = (e: FieldEditorComponent<any>) => {
        this.editor = e;
    }

    componentDidMount() {
        window.addEventListener("message", this.handleMessage, null);
        this.postMessage({type: "ready"});
    }

    postMessage(msgData: MessageData) {
        window.parent.postMessage(msgData, "*");
    }

    componentWillUnmount() {
        window.removeEventListener("message", this.handleMessage, null);
    }

    callbackOnDoneClick = () => {
        this.updateAndSendJres();
    }

    updateAndSendJres() {
        this.currentJres = this.editor.getJres();
        const updateMsg: MessageData = {
            type: "update",
            message: this.currentJres,
            _fromVscode: false,
        }
        this.postMessage(updateMsg);
    }

    render() {
        return <ImageFieldEditor ref={this.refHandler} singleFrame={true} parentCallback={this.callbackOnDoneClick} />
    }
}

