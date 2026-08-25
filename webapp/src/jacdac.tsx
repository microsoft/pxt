import * as React from "react"
import * as pkg from "./package"
import * as sui from "./sui"
import * as srceditor from "./srceditor"
import * as simulator from "./simulator"

import { fireClickOnEnter } from "./util"

import IProjectView = pxt.editor.IProjectView;

export class Editor extends srceditor.Editor {
    private simulatorContainerRef: HTMLDivElement;

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

    loadFileAsync(file: pkg.File, hc?: boolean): Promise<void> {
        // give the jacdac simulator a larger view; the board simulator(s) stay
        // in the sidebar and keep running
        if (this.simulatorContainerRef)
            simulator.driver?.showJacdacSimulator(this.simulatorContainerRef);
        return super.loadFileAsync(file, hc);
    }

    unloadFileAsync(unloadToHome?: boolean): Promise<void> {
        simulator.driver?.hideJacdacSimulator();
        return super.unloadFileAsync(unloadToHome);
    }

    private handleSimulatorRef = (el: HTMLDivElement) => {
        this.simulatorContainerRef = el;
        if (el)
            simulator.driver?.showJacdacSimulator(el);
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
                <div id="jacdacSimulator" ref={this.handleSimulatorRef} />
            </div>
        )
    }
}

