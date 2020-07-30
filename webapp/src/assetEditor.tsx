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
    relabelDoneButtonToSave();
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

    handleMessage = (msg: Message)  => {
        if (msg.data._fromVscode) {
            if (msg.data.type === "initialize") {
                this.editor.loadJres(msg.data.message);
            } else if (msg.data.type === "update") {
                this.sendJres();
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
        this.sendJres();
    }

    sendJres() {
        const updateMsg: MessageData = {
            type: "update",
            message: this.editor.getJres(),
        }
        this.postMessage(updateMsg);
    }

    render() {
        return <ImageFieldEditor ref={this.refHandler} singleFrame={true} doneButtonCallback={this.callbackOnDoneClick} />
    }
}

function relabelDoneButtonToSave() {
    let button = document.getElementsByClassName('image-editor-confirm')[0] as HTMLDivElement;
    button.innerText = "Save";
}

