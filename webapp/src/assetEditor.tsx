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

export class AssetEditor extends React.Component {
    private editor: FieldEditorComponent<any>;

    handleMessage = (msg: any)  => {
        if (msg.data._fromVscode && msg.data.type === "update") {
            this.editor.loadJres(msg.data.message);
        }
    }

    refHandler = (e: FieldEditorComponent<any>) => {
        this.editor = e;
    }

    componentDidMount() {
        window.onmessage = this.handleMessage;
        window.parent.postMessage({type: "ready" }, "*")
    }

    render() {
        return <div><ImageFieldEditor ref={this.refHandler} singleFrame={true} />
        </div>
    }
}

