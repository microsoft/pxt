/// <reference path="../../localtypings/smoothie.d.ts" />

import * as React from "react"
import * as pkg from "./package"
import * as core from "./core"
import * as srceditor from "./srceditor"
import * as sui from "./sui"
import * as codecard from "./codecard"
import * as canvaschart from "./canvaschart"

import Cloud = pxt.Cloud
import Util = pxt.Util

const lf = Util.lf

export class Editor extends srceditor.Editor {

    private smoothies: IChartInfoObject[] = []
    private consoleEntries: IConsoleEntry[] = []
    private consoleBuffer: string = ""
    // TODO pass these values in with props or config?
    private shouldScroll = false
    private isSim: boolean = true
    private maxLineLength: number = 500
    private maxConsoleEntries: number = 20
    private active: boolean = true

    acceptsFile(file: pkg.File) {
        // TODO hardcoded string
        return file.name === "serial.txt"
    }

    isGraphable(v: string) {
        return /[a-z]*:[0-9.]*/.test(v)
    }

    setSim(b: boolean) {
        this.isSim = b
        this.clear()
        //TODO 
        this.setLabel(this.isSim ? lf("Simulator serial output") : lf("Device serial output"))
    }

    constructor(public parent: pxt.editor.IProjectView) {
        super(parent)
        window.addEventListener("message", this.processMessage.bind(this), false)
    }

    processMessage(ev: MessageEvent) {
        let msg = ev.data
        if (this.active && msg.type === "serial") {
            const smsg = msg as pxsim.SimulatorSerialMessage
            const sim = !!smsg.sim
            if (sim == this.isSim) {
                const data = smsg.data || ""
                const source = smsg.id || "?"
                let theme = source.split("-")[0] || "black"

                if (this.isGraphable(data)) {
                    this.appendGraphEntry(source, data, theme, sim)
                } else {
                    this.appendConsoleEntry(data)
                }
            }
        }
    }

    appendGraphEntry(source: string, data: string, theme: string, sim: boolean) {
        let m = /^\s*(([^:]+):)?\s*(-?\d+)/i.exec(data)
        let variable = m ? (m[2] || ' ') : undefined
        let nvalue = m ? parseInt(m[3]) : null

        let last: IChartInfoObject = undefined

        for (let i = 0; i < this.smoothies.length; ++i) {
            let chart = this.smoothies[i]
            if (chart.source === source && chart.variable === variable) {
                last = chart
                break
            }
        }

        if (last) {
            last.line.append(new Date().getTime(), nvalue)
        } else {
            let newLine = new TimeSeries()
            //TODO abstract this into function/config
            let newChart = new SmoothieChart({
                responsive: true,
                grid: { lineWidth: 1, millisPerLine: 250, verticalSections: 6 },
                labels: { fillStyle: 'rgb(255, 255, 0)' }
            })
            newChart.addTimeSeries(newLine, {strokeStyle: 'rgba(0, 255, 0, 1)', fillStyle: 'rgba(0, 255, 0, 0.2)', lineWidth: 4})
            let newCanvas = document.createElement("canvas")
            newCanvas.setAttribute("style", "height:200px; width:100%;")
            document.getElementById("graphs").appendChild(newCanvas)
            newChart.streamTo(newCanvas)
            this.smoothies.push({
                element: newCanvas,
                chart: newChart,
                line: newLine,
                source: source,
                variable: variable
            })
        }
    }

    appendConsoleEntry(data: string) {
        for (let i = 0; i < data.length; ++i) {
            let ch = data[i]
            this.consoleBuffer += ch
            if (ch === "\n" || this.consoleBuffer.length > this.maxLineLength) {
                let consoleEntry: IConsoleEntry = {
                    data: this.consoleBuffer,
                    dirty: true
                }
                this.consoleEntries.push(consoleEntry)
                this.consoleBuffer = ""
                while (this.consoleEntries.length > this.maxConsoleEntries) {
                    let po = this.consoleEntries.shift();
                    if (po.element && po.element.parentElement) po.element.parentElement.removeChild(po.element);
                }
                //this.scheduleRender()
            }
        }
    }

    //TODO tight coupling
    stopSmoothies() {
        this.smoothies.forEach(s => s.chart.stop())
    }

    startSmoothies() {
        this.smoothies.forEach(s => s.chart.start())
    }

    clear() {
        //TODO something
        this.smoothies.forEach((s) => {
            s.element.parentElement.removeChild(s.element)
        })
        this.smoothies = []
    }

    display() {
        return (
            <div id="serialEditor">
                <sui.Button text={lf("Start")} onClick= {() => {this.active = true; this.startSmoothies()}} />
                <sui.Button text={lf("Stop")} onClick = {() => {this.active = false; this.stopSmoothies()}} />
                <div id="graphs">
                </div>
                <div id="console"></div>
            </div>
        )
    }

    domUpdate() {
        //TODO should this be here?
        this.startSmoothies()
    }

    setLabel(text: string, theme?: string) {
        //TODO look at this
        /**
        if (this.labelElement && this.labelElement.innerText == text) return

        if (this.labelElement) {
            if (this.labelElement.parentElement) this.labelElement.parentElement.removeChild(this.labelElement)
            this.labelElement = undefined
        }
        if (text) {
            this.labelElement = document.createElement("a")
            this.labelElement.className = `ui ${theme} top right attached mini label`
            this.labelElement.appendChild(document.createTextNode(text))
        }
        **/
    }
}

interface IConsoleEntry {
    data: string
    dirty: boolean
    element?: HTMLElement
}

interface IChartInfoObject {
    element: HTMLCanvasElement,
    chart: SmoothieChart,
    line: TimeSeries,
    source: string,
    variable: string
}