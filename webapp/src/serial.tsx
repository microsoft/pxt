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

    private chartWrappers: ChartWrapper[] = []
    private consoleEntries: string[] = []
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

        //See if there is a "home chart" that this point belongs to -
        //if not, create a new chart
        let homeChart: ChartWrapper = undefined
        for (let i = 0; i < this.chartWrappers.length; ++i) {
            let chartWrapper = this.chartWrappers[i]
            if (chartWrapper.shouldContain(source, variable)) {
                homeChart = chartWrapper
                break
            }
        }
        if (homeChart) {
            homeChart.addPoint(nvalue)
        } else {
            let newChart = new ChartWrapper(source, variable, nvalue)
            this.chartWrappers.push(newChart)
            document.getElementById("charts").appendChild(newChart.getElement())
        }
    }

    appendConsoleEntry(data: string) {
        for (let i = 0; i < data.length; ++i) {
            let ch = data[i]
            this.consoleBuffer += ch
            if (ch === "\n" || this.consoleBuffer.length > this.maxLineLength) {
                let newEntry = document.createElement("div")
                newEntry.textContent = this.consoleBuffer
                let consoleRoot = document.getElementById("console")
                consoleRoot.appendChild(newEntry)
                if (consoleRoot.childElementCount > this.maxConsoleEntries) {
                    consoleRoot.removeChild(consoleRoot.firstChild)
                }
                this.consoleBuffer = ""
            }
        }
    }

    stopRecording() {
        this.chartWrappers.forEach(s => s.stop())
    }

    startRecording() {
        this.chartWrappers.forEach(s => s.start())
    }

    clearNode(e: HTMLElement) {
        while (e.hasChildNodes()) {
            e.removeChild(e.firstChild)
        }
    }

    clear() {
        let chartRoot = document.getElementById("charts")
        let consoleRoot = document.getElementById("console")
        this.clearNode(chartRoot)
        this.clearNode(consoleRoot)
        this.chartWrappers = []
        this.consoleEntries = []
        this.consoleBuffer = ""
    }

    display() {
        return (
            <div id="serialEditor">
                <div id="serialEditorTitle">{this.isSim ? "Simulator serial data" : "Device serial data"}</div>
                <sui.Button text={lf("Start")} onClick= {() => {this.active = true; this.startRecording()}} />
                <sui.Button text={lf("Stop")} onClick = {() => {this.active = false; this.stopRecording()}} />
                <div id="charts"></div>
                <div id="console"></div>
            </div>
        )
    }

    domUpdate() {
        //TODO
    }
}

class ChartWrapper {
    private rootElement: HTMLElement
    //private labelElement: HTMLElement
    //private element: HTMLCanvasElement
    private chart: SmoothieChart
    private line: TimeSeries
    private source: string
    private variable: string
    private chartConfig = {
        responsive: true,
        grid: { lineWidth: 1, millisPerLine: 250, verticalSections: 6 },
        labels: { fillStyle: 'rgb(255, 255, 0)' }
    }
    private lineConfig =  {strokeStyle: 'rgba(0, 255, 0, 1)', fillStyle: 'rgba(0, 255, 0, 0.2)', lineWidth: 4}

    constructor(source: string, variable: string, value: number) {
        this.source = source
        this.variable = variable
        this.line = new TimeSeries()
        this.chart = new SmoothieChart(this.chartConfig)
        this.chart.addTimeSeries(this.line, this.lineConfig)

        this.rootElement = document.createElement("div")
        let canvas = document.createElement("canvas")
        //TODO
        canvas.setAttribute("style", "height:200px; width:100%;")
        this.chart.streamTo(canvas)

        let label = document.createElement("span")
        label.innerText = this.variable
        this.rootElement.appendChild(label)
        this.rootElement.appendChild(canvas)

        this.addPoint(value)
    }

    public getElement() {
        return this.rootElement
    }

    public shouldContain(source: string, variable: string) {
        return this.source == source && this.variable == variable
    }

    public addPoint(value: number) {
        this.line.append(new Date().getTime(), value)
    }

    public start() {
        this.chart.start()
    }

    public stop() {
        this.chart.stop()
    }
}