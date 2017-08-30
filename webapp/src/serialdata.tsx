import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"
import * as sui from "./sui";
import * as codecard from "./codecard"
import * as canvaschart from "./canvaschart"

import Cloud = pxt.Cloud;
import Util = pxt.Util;

const lf = Util.lf

export class Editor extends srceditor.Editor {
//    private points: canvaschart.Point[] = [];
    private view: pxsim.logs.LogViewElement;
    // TODO: pass this in at initialization
    public isSim: boolean = true;
    private element: HTMLDivElement;

    acceptsFile(file: pkg.File) {
        // TODO hardcoded string
        return file.name === "serialdata.json"
    }

    constructor(public parent: pxt.editor.IProjectView) {
        super(parent)
        this.view = new pxsim.logs.LogViewElement({
            isSim: this.isSim,
            maxEntries: 80,
            maxLineLength: 500,
            maxAccValues: 500
        })
        this.view.setLabel(this.isSim ? lf("SIM") : lf("DEV"));
    }

    display() {
        return (
            <div ref={(el) => {this.element = el}}>
            </div>
        )
    }

    domUpdate() {
        this.element.appendChild(this.view.element);
    }
}