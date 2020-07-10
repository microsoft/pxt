/// <reference path="../../built/pxtlib.d.ts"/>

import * as React from "react";
import * as ReactDOM from "react-dom";

import { ImageFieldEditor } from "./components/ImageFieldEditor";

document.addEventListener("DOMContentLoaded", () => {
    init();
    window.onmessage = handleMessage;
})

function init() {
    const assetDiv = document.getElementById("asset-editor-field-div") as HTMLDivElement;
    ReactDOM.render(<AssetEditor />, assetDiv);
}

export class AssetEditor extends React.Component {
    render() {
        return <ImageFieldEditor singleFrame={true} />
    }
}

function handleMessage(msg: any) {
    console.log("pxt: " + msg.data.type, msg.data.message);
}
