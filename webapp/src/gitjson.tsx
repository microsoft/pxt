import * as React from "react"
import * as pkg from "./package"
import * as core from "./core"
import * as srceditor from "./srceditor"
import * as sui from "./sui"
import * as data from "./data";

import Util = pxt.Util

export class Editor extends srceditor.Editor {

    getId() {
        return "githubEditor"
    }

    hasHistory() { return false; }

    hasEditorToolbar() {
        return false
    }

    setVisible(b: boolean) {
        this.isVisible = b
    }

    setHighContrast(hc: boolean) {
    }

    acceptsFile(file: pkg.File) {
        return file.name === pxt.github.GIT_JSON;
    }

    constructor(public parent: pxt.editor.IProjectView) {
        super(parent)
        this.goBack = this.goBack.bind(this);
    }

    goBack() {
        pxt.tickEvent("github.backButton", undefined, { interactiveConsent: true })
        this.parent.openPreviousEditor()
    }

    display() {
        const gihutId = pxt.github.parseRepoId(pkg.mainEditorPkg().header.githubId);

        return (
            <div id="serialArea">
                <div id="serialHeader" className="ui serialHeader">
                    <div className="leftHeaderWrapper">
                        <div className="leftHeader">
                            <sui.Button title={lf("Go back")} tabIndex={0} onClick={this.goBack} onKeyDown={sui.fireClickOnEnter}>
                                <sui.Icon icon="arrow left" />
                                <span className="ui text landscape only">{lf("Go back")}</span>
                            </sui.Button>
                            <span>
                                <i className="github icon" />
                                {gihutId.fullName}
                            </span>
                        </div>
                    </div>
                    <div className="rightHeader">
                    </div>
                </div>
            </div>
        )
    }

    domUpdate() {
    }
}
