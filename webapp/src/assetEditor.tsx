/// <reference path="../../built/pxtlib.d.ts"/>

import * as React from "react";
import * as ReactDOM from "react-dom";

import { ImageFieldEditor } from "./components/ImageFieldEditor";
import { FieldEditorComponent } from "./blocklyFieldView";
import { TilemapFieldEditor } from "./components/TilemapFieldEditor";
import { setTelemetryFunction } from './components/ImageEditor/store/imageReducer';


document.addEventListener("DOMContentLoaded", () => {
    init();
})

function init() {
    const assetDiv = document.getElementById("asset-editor-field-div") as HTMLDivElement;
    ReactDOM.render(<AssetEditor />, assetDiv);
}

type AssetType = "sprite" | "tilemap";

interface AssetEditorState {
    viewType: AssetType;
}

export interface Message {
    data: MessageData;
}
export interface MessageData {
    type: string;
    message?: string;
    _fromVscode?: boolean;
    name?: string;
}

export class AssetEditor extends React.Component<{}, AssetEditorState> {
    private editor: FieldEditorComponent<any>;

    constructor(props: {}) {
        super(props);

        let view: AssetType = "sprite";
        const v = /view(?:[:=])([a-zA-Z]+)/i.exec(window.location.href)
        if (v && v[1] === "tilemap") {
            view = "tilemap";
        }
        this.state = { viewType: view };

        setTelemetryFunction(tickAssetEditorEvent);
    }

    handleMessage = (msg: Message)  => {
        if (msg.data._fromVscode) {
            if (msg.data.type === "initialize") {
                switch (this.state.viewType) {
                    case "sprite":
                        this.editor.loadJres(msg.data.message);
                        break;
                    case "tilemap":
                        // TODO: create a way to update tilemap from JSON
                        this.editor.loadJres(msg.data.message, msg.data.name);
                        break;
                }
            } else if (msg.data.type === "update") {
                this.sendJres();
            }
        }
    }

    refHandler = (e: FieldEditorComponent<any>) => {
        this.editor = e;
        if (this.state.viewType === "tilemap") {
            const tmProject = new pxt.TilemapProject({});
            const emptyTM = tmProject.blankTilemap(16);
            this.editor.init(emptyTM, () => {});
        }
    }

    componentDidMount() {
        window.addEventListener("message", this.handleMessage, null);
        this.postMessage({type: "ready", message: this.state.viewType});
        tickAssetEditorEvent("asset-editor-shown");
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
        if (this.state.viewType === "tilemap") {
            return <TilemapFieldEditor ref={ this.refHandler } doneButtonCallback={this.callbackOnDoneClick} />
        }
        return <ImageFieldEditor ref={this.refHandler} singleFrame={true} doneButtonCallback={this.callbackOnDoneClick} />
    }

}

function tickAssetEditorEvent(event: string) {
    pxt.tickEvent("asset.editor", {
        action: event
    });
}
