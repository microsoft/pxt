/// <reference path="../../built/pxtlib.d.ts"/>

import * as React from "react";
import * as ReactDOM from "react-dom";

import { ImageEditor } from "./components/ImageEditor/ImageEditor";

export interface EditorBounds {
    top: number;
    left: number;
    width: number;
    height: number;
}

let cachedBounds: EditorBounds;
let current: FieldEditorView;

export class FieldEditorView implements pxt.react.FieldEditorView {
    protected resizeFrameRef: number;
    protected visible: boolean;
    protected editorBounds: EditorBounds;

    protected hideCallback: () => void;

    constructor(protected contentDiv: HTMLDivElement) {
    }

    injectElement(element: JSX.Element) {
        ReactDOM.render(element, this.contentDiv);
    }

    show() {
        this.visible = true;
        this.resize(this.editorBounds);
        this.contentDiv.style.display = "";
    }

    hide() {
        this.visible = false;
        this.clearContents();
        this.contentDiv.style.display = "none";

        if (this.hideCallback) this.hideCallback();
    }

    onHide(cb: () => void) {
        this.hideCallback = cb;
    }

    getResult() {
        return "";
    }

    resize(editorBounds: EditorBounds) {
        this.editorBounds = editorBounds;

        if (this.visible) {
            if (this.resizeFrameRef) cancelAnimationFrame(this.resizeFrameRef);
            this.resizeFrameRef = requestAnimationFrame(this.resizeContentCore);
        }
    }

    dispose() {
        this.hide();
        this.contentDiv = null;
    }

    protected clearContents() {
        ReactDOM.unmountComponentAtNode(this.contentDiv);
        while (this.contentDiv.firstChild) this.contentDiv.removeChild(this.contentDiv.firstChild);
    }

    protected resizeContentCore = () => {
        this.resizeFrameRef = undefined;

        const padding = Math.max(this.editorBounds.width, this.editorBounds.height) / 16;

        this.contentDiv.style.left = (this.editorBounds.left + padding) + "px";
        this.contentDiv.style.top = (this.editorBounds.top + padding) + "px";
        this.contentDiv.style.width = (this.editorBounds.width - padding * 2) + "px";
        this.contentDiv.style.height = (this.editorBounds.height - padding * 2) + "px";
    }
}

export function setEditorBounds(editorBounds: EditorBounds) {
    if (current) {
        current.resize(editorBounds)
    }
    cachedBounds = editorBounds;
}

export function init() {
    pxt.react.getFieldEditorView = (fieldEditorId: string, value: string, options: any) => {
        if (current) current.dispose();

        current = new FieldEditorView(document.getElementById("blocks-editor-field-div") as HTMLDivElement);
        current.injectElement(<ImageEditor />);
        if (cachedBounds) current.resize(cachedBounds);


        return current;
    }
}