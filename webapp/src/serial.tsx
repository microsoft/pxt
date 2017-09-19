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
    chartWrappers: Chart[] = []
    chartIdx: number = 0
    consoleBuffer: string = ""
    // TODO pass these values in with props or config
    isSim: boolean = true
    maxConsoleLineLength: number = 500
    maxConsoleEntries: number = 100
    active: boolean = true
    rawDataBuffer: string = ""
    //TODO reasonable buffer size?
    maxBufferLength: number = 5000

    getId() {
        return "serialEditor"
    }

    acceptsFile(file: pkg.File) {
        return file.name === pxt.SERIAL_EDITOR_FILE
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
            //TODO y tho
            const smsg = msg as pxsim.SimulatorSerialMessage
            const sim = !!smsg.sim
            if (sim == this.isSim) {
                const data = smsg.data || ""
                const source = smsg.id || "?"
                //TODO not using theme anymore
                let theme = source.split("-")[0] || "black"

                //TODO incorporate source?
                this.appendRawData(data)

                if (this.isGraphable(data)) {
                    this.appendGraphEntry(source, data, theme, sim)
                } else {
                    //TODO incorporate source?
                    this.appendConsoleEntry(data)
                }
            }
        }
    }

    appendRawData(data: string) {
        this.rawDataBuffer += data
        let excessChars = this.rawDataBuffer.length - this.maxBufferLength 
        if (excessChars > 0) {
            this.rawDataBuffer = this.rawDataBuffer.slice(excessChars)
        }
    }

    appendGraphEntry(source: string, data: string, theme: string, sim: boolean) {
        let m = /^\s*(([^:]+):)?\s*(-?\d+)/i.exec(data)
        let variable = m ? (m[2] || ' ') : undefined
        let nvalue = m ? parseInt(m[3]) : null

        //See if there is a "home chart" that this point belongs to -
        //if not, create a new chart
        let homeChart: Chart = undefined
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
            let newChart = new Chart(source, variable, nvalue, this.chartIdx)
            this.chartIdx++
            this.chartWrappers.push(newChart)
            let serialChartRoot = document.getElementById("serialCharts")
            serialChartRoot.appendChild(newChart.getElement())
        }
    }

    appendConsoleEntry(data: string) {
        for (let i = 0; i < data.length; ++i) {
            let ch = data[i]
            this.consoleBuffer += ch
            if (ch === "\n" || this.consoleBuffer.length > this.maxConsoleLineLength) {
                let newEntry = document.createElement("div")
                newEntry.textContent = this.consoleBuffer
                let consoleRoot = document.getElementById("serialConsole")
                consoleRoot.appendChild(newEntry)
                if (consoleRoot.childElementCount > this.maxConsoleEntries) {
                    consoleRoot.removeChild(consoleRoot.firstChild)
                }
                this.consoleBuffer = ""
            }
        }
    }

    pauseRecording() {
        this.chartWrappers.forEach(s => s.stop())
    }

    startRecording() {
        this.chartWrappers.forEach(s => s.start())
    }

    toggleRecording() {
        if (this.active) {
            this.active = false
            this.pauseRecording()
            //TODO nooooo
            document.getElementById("serialRecordButton").className = "record icon"
        } else {
            this.active = true
            this.startRecording()
            document.getElementById("serialRecordButton").className = "pause icon"
        }
    }

    clearNode(e: HTMLElement) {
        while (e.hasChildNodes()) {
            e.removeChild(e.firstChild)
        }
    }

    clear() {
        let chartRoot = document.getElementById("serialCharts")
        let consoleRoot = document.getElementById("serialConsole")
        this.clearNode(chartRoot)
        this.clearNode(consoleRoot)
        this.chartWrappers = []
        this.consoleBuffer = ""
    }

    entriesToPlaintext() {
        return this.rawDataBuffer
    }

    showExportDialog() {
        const targetTheme = pxt.appTarget.appTheme
        let rootUrl = targetTheme.embedUrl
        if (!rootUrl) {
            pxt.commands.browserDownloadAsync(this.entriesToPlaintext(), "data.txt", "text/plain")
            return;
        }
        if (!/\/$/.test(rootUrl)) rootUrl += '/';

        core.confirmAsync({
            logos: undefined,
            header: lf("Analyze Data"),
            hideAgree: true,
            disagreeLbl: lf("Close"),
            onLoaded: (_) => {
                _.find('#datasavelocalfile').click(() => {
                    _.modal('hide');
                    pxt.commands.browserDownloadAsync(this.entriesToPlaintext(), "data.txt", "text/plain")
                })
            },
            htmlBody:
                `<div></div>
                <div class="ui cards" role="listbox">
                    <div class="ui card">
                        <div class="content">
                            <div class="header">${lf("Local File")}</div>
                            <div class="description">
                                ${lf("Save the data to your 'Downloads' folder.")}
                            </div>
                        </div>
                        <div id="datasavelocalfile" class="ui bottom attached button">
                            <i class="download icon"></i>
                            ${lf("Download data")}
                        </div>        
                    </div>
                </div>`
        }).done()
    }

    goBack() {
        //TODO tight coupling
        this.parent.openPreviousEditor()
    }

    display() {
        return (
            <div id="serialArea">
                <div id="serialHeader" className="ui segment">
                <button className="ui left floated icon button" onClick={this.goBack.bind(this)}>
                        <i className="arrow left icon"></i>
                    </button>
                    <span className="ui huge header">{this.isSim ? lf("Simulator") : lf("Device")}</span>
                    <button className="ui right floated icon button" onClick={this.showExportDialog().bind(this)}>
                        <i className="download icon"></i>
                    </button>
                    <button className="ui right floated icon button" onClick ={this.toggleRecording.bind(this)}>
                        <i id="serialRecordButton" className={this.active ? "pause icon" : "record icon"}></i>
                    </button>
                </div>
                <div id="serialCharts"></div>
                <div className="ui fitted divider"></div>
                <div id="serialConsole"></div>
            </div>
        )
    }

    domUpdate() {
    }
}

class Chart {
    rootElement: HTMLElement = document.createElement("div")
    canvas: HTMLCanvasElement = undefined
    line: TimeSeries = new TimeSeries()
    source: string
    variable: string
    chartConfig = {
        responsive: true,
        interpolation: "linear",
        fps: 30,
        millisPerPixel: 20,
        grid: { strokeStyle: '#555555', lineWidth: 1, millisPerLine: 1000, verticalSections: 4}
    }
    chart: SmoothieChart = new SmoothieChart(this.chartConfig)
    lineConfigs = [
        { strokeStyle: 'rgba(255, 0, 0, 1)', fillStyle: 'rgba(255, 0, 0, 0.2)', lineWidth: 4 },
        { strokeStyle: 'rgba(0, 0, 255, 1)', fillStyle: 'rgba(0, 0, 255, 0.2)', lineWidth: 4 },
        { strokeStyle: 'rgba(0, 255, 0, 1)', fillStyle: 'rgba(0, 255, 0, 0.2)', lineWidth: 4 },
        { strokeStyle: 'rgba(255, 255, 0, 1)', fillStyle: 'rgba(255, 255, 0, 0.2)', lineWidth: 4 }
    ]

    constructor(source: string, variable: string, value: number, chartIdx: number) {
        this.rootElement.className = "ui segment"
        this.source = source
        this.variable = variable
        this.chart.addTimeSeries(this.line, this.lineConfigs[chartIdx%4])

        let canvas = this.makeCanvas()
        let label = this.makeLabel()
        this.rootElement.appendChild(label)
        this.rootElement.appendChild(canvas)

        this.addPoint(value)
    }

    makeLabel() {
        let label = document.createElement("div")
        label.className = "ui top left huge attached label"
        label.innerText = this.variable
        return label
    }

    makeCanvas() {
        let canvas = document.createElement("canvas")
        this.chart.streamTo(canvas)
        this.canvas = canvas
        return canvas
    }

    getCanvas() {
        return this.canvas
    }

    getElement() {
        return this.rootElement
    }

    shouldContain(source: string, variable: string) {
        return this.source == source && this.variable == variable
    }

    addPoint(value: number) {
        this.line.append(new Date().getTime(), value)
    }

    start() {
        this.chart.start()
    }

    stop() {
        this.chart.stop()
    }
}