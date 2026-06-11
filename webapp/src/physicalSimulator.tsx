import * as React from "react"
import * as Smoothie from "smoothie"
import * as pkg from "./package"
import * as core from "./core"
import * as sui from "./sui"
import * as srceditor from "./srceditor"

import IEditor = pxt.editor.IEditor;

export type ViewState = any;

export interface ParentProps {
    parent: IProjectView;
}

import Util = pxt.Util
import { fireClickOnEnter } from "./util"

import IProjectView = pxt.editor.IProjectView;

export class PhysicalSimulator extends srceditor.Editor {
    isVisible = false;
    isSim: boolean = true;
    active: boolean = true

    lineColors: string[];
    hcLineColors: string[];
    currentLineColors: string[];
    highContrast?: boolean = false;

    getId() {
        return "physicalSimulator"
    }

    hasHistory() { return false; }

    hasEditorToolbar() {
        return false
    }

    acceptsFile(file: pkg.File) {
        return file.name === pxt.PHYSICAL_SIMULATOR_EDITOR_FILE;
    }

    setVisible(b: boolean) {
        // TODO: It'd be great to re-render this component dynamically when the contrast changes,
        // TODO: but for now the user has to toggle the serial editor to see a change.
        const highContrast = core.getHighContrastOnce();
        if (highContrast !== this.highContrast) {
            this.setHighContrast(highContrast)
        }
        this.isVisible = b;
    }

    setHighContrast(hc: boolean) {
        if (hc !== this.highContrast) {
            this.highContrast = hc;
            if (hc) {
                this.currentLineColors = this.hcLineColors
            } else {
                this.currentLineColors = this.lineColors
            }
            this.clear()
        }
    }

    setSim(b: boolean) {
        if (this.isSim != b) {
            this.isSim = b
            this.clear()
        }
    }

    simStateChanged() {
        // this.charts.forEach((chart) => chart.setRealtimeData(this.wantRealtimeData()));
    }

    constructor(public parent: IProjectView) {
        super(parent);
        window.addEventListener("message", this.processEvent.bind(this), false)
        const serialTheme = pxt.appTarget.serial && pxt.appTarget.serial.editorTheme;
        this.lineColors = (serialTheme && serialTheme.lineColors) || ["#e00", "#00e", "#0e0"];
        this.hcLineColors = ["#000"];
        this.currentLineColors = this.lineColors;

        this.goBack = this.goBack.bind(this);
        this.addSimulator = this.addSimulator.bind(this);
    }

    processEvent(ev: MessageEvent) {
        let msg = ev.data
        if (msg.type === "serial") {
            this.processEventCore(msg);
        }
        else if (msg.type === "bulkserial") {
            (msg as pxsim.SimulatorBulkSerialMessage).data.forEach(datum => {
                this.processEventCore({
                    type: "serial",
                    data: datum.data,
                    receivedTime: datum.time,
                    sim: msg.sim,
                    id: msg.id
                } as pxsim.SimulatorSerialMessage);
            })
        }
    }

    processEventCore(smsg: pxsim.SimulatorSerialMessage) {
        const isClearLog = smsg.csvType === "clear";

        smsg.receivedTime = smsg.receivedTime || Util.now();

        this.processMessage(smsg);
    }

    processMessage(smsg: pxsim.SimulatorSerialMessage) {
        const sim = !!smsg.sim
        const isCsv = !!smsg.csvType
        if (sim != this.isSim) return;

    }

    clearNode(e: HTMLElement) {

    }

    clear() {
        if (!this.isSim) {
           //
        }

        //pxt.BrowserUtils.addClass(this.serialRoot, "hide-view-latest");

        // If the editor is currently visible, leave these as is to leave toggle state.
        if (!this.isVisible) {
            // if (this.serialRoot) {
                // pxt.BrowserUtils.addClass(this.serialRoot, "no-toggle")
            // }
        }
    }

    goBack() {
        pxt.tickEvent("serial.backButton", undefined, { interactiveConsent: true })
        this.parent.openPreviousEditor()
    }

    addSimulator() {
        pxt.tickEvent("serial.newBoardButton", undefined, { interactiveConsent: true })
        this.parent.addSimulator()
    }

    display() {
        return (
            <div id="serialArea" className="no-toggle">
                <div id="serialHeader" className="ui serialHeader">
                    <div className="leftHeaderWrapper">
                        <div className="leftHeader">
                            <sui.Button title={lf("Go back")} tabIndex={0} onClick={this.goBack} onKeyDown={fireClickOnEnter} className="neutral">
                                <sui.Icon icon="arrow left" />
                                <span className="ui text landscape only">{lf("Go back")}</span>
                            </sui.Button>
                            <sui.Button title={lf("Add simulator")} tabIndex={0} onClick={this.addSimulator} onKeyDown={fireClickOnEnter} className="neutral">
                                <sui.Icon icon="plus" />
                                <span className="ui text landscape only">{lf("Add simulator")}</span>
                            </sui.Button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    domUpdate() {
    }
}
