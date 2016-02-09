/// <reference path="../blockly/blockly.d.ts" />

import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"


var lf = Util.lf

export class Editor extends srceditor.Editor {
    editor: Blockly.Workspace;

    prepare() {
        /*
        this.editor = ace.edit("blocksEditor")

        sess.on("change", () => {
                this.changeCallback();
        })
        */

        this.isReady = true
    }

    getId() {
        return "blocksEditor"
    }

    setTheme(theme: srceditor.Theme) {
    }

    getViewState() {
        // ZOOM etc
        return {}
    }

    getCurrentSource() {
        // XML
        return ""
    }

    acceptsFile(file: pkg.File) {
        return file.getExtension() == "blocks"
    }

    loadFile(file: pkg.File) {
        // ...
        this.setDiagnostics(file)
    }

    setDiagnostics(file: pkg.File) {
    }

    setViewState(pos: {}) {
    }
}
