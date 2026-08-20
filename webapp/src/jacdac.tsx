import * as React from "react"
import * as pkg from "./package"
import * as sui from "./sui"
import * as srceditor from "./srceditor"

import { fireClickOnEnter } from "./util"

import IProjectView = pxt.editor.IProjectView;

export class Editor extends srceditor.Editor {
    constructor(public parent: IProjectView) {
        super(parent)
        this.goBack = this.goBack.bind(this);
    }

    getId() {
        return "jacdacEditor"
    }

    hasHistory() { return false; }

    hasEditorToolbar() {
        return false
    }

    acceptsFile(file: pkg.File) {
        return file.name === pxt.JACDAC_EDITOR_FILE;
    }

    goBack() {
        pxt.tickEvent("jacdac.backButton", undefined, { interactiveConsent: true })
        this.parent.openPreviousEditor()
    }

    display() {
        return (
            <div id="jacdacArea">
                <div id="jacdacHeader" className="ui serialHeader">
                    <div className="leftHeaderWrapper">
                        <div className="leftHeader">
                            <sui.Button title={lf("Go back")} tabIndex={0} onClick={this.goBack} onKeyDown={fireClickOnEnter} className="neutral">
                                <sui.Icon icon="arrow left" />
                                <span className="ui text landscape only">{lf("Go back")}</span>
                            </sui.Button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}
