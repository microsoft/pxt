/// <reference path="../../built/pxtlib.d.ts"/>

import * as React from "react";
import * as ReactDOM from "react-dom";

import { ImageFieldEditor } from "./components/ImageFieldEditor";

export interface EditorBounds {
    top: number;
    left: number;
    width: number;
    height: number;
}

export interface FieldEditorComponent extends React.Component {
    init(value: string, close: () => void, options?: any): void;
    getValue(): string;

    getPersistentData(): any;
    restorePersistentData(value: any): void;
    onResize?: () => void;
}

let cachedBounds: EditorBounds;
let current: FieldEditorView;

export class FieldEditorView implements pxt.react.FieldEditorView {
    protected resizeFrameRef: number;
    protected visible: boolean;
    protected editorBounds: EditorBounds;
    protected contentBounds: EditorBounds;
    protected componentRef: FieldEditorComponent;
    protected overlayDiv: HTMLDivElement;
    protected persistentData: any;

    protected hideCallback: () => void;

    constructor(protected contentDiv: HTMLDivElement) {
    }

    injectElement(element: JSX.Element) {
        ReactDOM.render(element, this.contentDiv);
    }

    setRef(ref: FieldEditorComponent) {
        this.componentRef = ref;

        if (ref && this.persistentData) {
            ref.restorePersistentData(this.persistentData);
            this.persistentData = undefined;
        }
    }

    show() {
        if (this.visible || !this.contentDiv) return;

        this.visible = true;
        this.resize(this.editorBounds);
        this.contentDiv.style.display = "";

        this.overlayDiv = document.createElement("div");
        pxt.BrowserUtils.addClass(this.overlayDiv, "blocks-editor-field-overlay")
        this.contentDiv.parentElement.appendChild(this.overlayDiv);

        this.overlayDiv.addEventListener("mousedown", this.handleOutsideClick);
        document.addEventListener("mousedown", this.handleOutsideClick);
    }

    hide() {
        if (!this.visible || !this.contentDiv) return;

        this.visible = false;
        if (this.resizeFrameRef) cancelAnimationFrame(this.resizeFrameRef);

        this.clearContents();
        this.contentDiv.style.display = "none";

        this.overlayDiv.parentElement.removeChild(this.overlayDiv);
        document.removeEventListener("mousedown", this.handleOutsideClick);

        if (this.hideCallback) this.hideCallback();
    }

    onHide(cb: () => void) {
        this.hideCallback = cb;
    }

    getResult() {
        return this.componentRef ? this.componentRef.getValue() : undefined;
    }

    resize(editorBounds: EditorBounds) {
        this.editorBounds = editorBounds;

        if (this.visible) {
            if (this.resizeFrameRef) cancelAnimationFrame(this.resizeFrameRef);
            this.resizeFrameRef = requestAnimationFrame(this.resizeContentCore);
        }
    }

    dispose() {
        if (!this.contentDiv) return;
        this.hide();
        this.contentDiv = null;
    }

    getPersistentData(): any {
        return this.componentRef.getPersistentData();
    }

    restorePersistentData(value: any): void {
        if (this.componentRef) this.componentRef.restorePersistentData(value);
        else this.persistentData = value;
    }

    protected clearContents() {
        ReactDOM.unmountComponentAtNode(this.contentDiv);
        while (this.contentDiv.firstChild) this.contentDiv.removeChild(this.contentDiv.firstChild);
    }

    protected resizeContentCore = () => {
        this.resizeFrameRef = undefined;
        const bounds = this.editorBounds;

        let horizontalPadding = 20;
        let verticalPadding = 20;


        if (bounds.width - (horizontalPadding * 2) < 500) {
            horizontalPadding = 0;
            verticalPadding = 0;
        }

        if (bounds.height - (verticalPadding * 2) < 610) {
            verticalPadding = Math.min(bounds.height - 610, 0) / 2;
            horizontalPadding = 0;
        }

        this.contentBounds = {
            left: bounds.left + horizontalPadding,
            top: bounds.top + verticalPadding,
            width: bounds.width - horizontalPadding * 2,
            height: bounds.height - verticalPadding * 2
        };

        this.contentDiv.style.left = this.contentBounds.left + "px";
        this.contentDiv.style.top = this.contentBounds.top + "px";
        this.contentDiv.style.width = this.contentBounds.width + "px";
        this.contentDiv.style.height = this.contentBounds.height + "px";

        this.overlayDiv.style.left = bounds.left + "px";
        this.overlayDiv.style.top = bounds.top + "px";
        this.overlayDiv.style.width = bounds.width + "px";
        this.overlayDiv.style.height = bounds.height + "px";

        if (this.componentRef && this.visible && this.componentRef.onResize) {
            this.componentRef.onResize();
        }
    }

    protected handleOutsideClick = (ev: MouseEvent) => {
        if (!this.contentBounds) return;

        if (!inBounds(ev.clientX, ev.clientY, this.contentBounds)) {
            this.hide();
        }
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

        const refHandler = (e: FieldEditorComponent) => {
            if (!e) return;

            if (current) {
                current.setRef(e);
                e.init(value, dismissIfVisible, options);
            }
        }

        current = new FieldEditorView(document.getElementById("blocks-editor-field-div") as HTMLDivElement);

        switch (fieldEditorId) {
            case "image-editor":
                current.injectElement(<ImageFieldEditor ref={ refHandler } singleFrame={true} />);
                break;
            case "animation-editor":
                current.injectElement(<ImageFieldEditor ref={ refHandler } singleFrame={false} />);
                break;
        }

        if (cachedBounds) current.resize(cachedBounds);

        return current;
    }
}

export function dismissIfVisible() {
    if (current) current.dispose();
    current = undefined;
}

function inBounds(x: number, y: number, bounds: EditorBounds) {
    return !(x < bounds.left || x > (bounds.left + bounds.width) || y < bounds.top || y > (bounds.top + bounds.height));
}