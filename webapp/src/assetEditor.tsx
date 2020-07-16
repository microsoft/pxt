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

    handleMessage = (msg: Message)  => {
        if (msg.data._fromVscode && msg.data.type === "update") {
            this.editor.loadJres(msg.data.message);
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

    render() {
        return <ImageFieldEditor ref={this.refHandler} singleFrame={true} />
    }
}

