/// <reference path="../../localtypings/smoothie.d.ts" />

import * as React from "react"
import * as pkg from "./package"
import * as core from "./core"
import * as srceditor from "./srceditor"
import * as sui from "./sui"
import * as codecard from "./codecard"

import Cloud = pxt.Cloud
import Util = pxt.Util

const lf = Util.lf

export class Editor extends srceditor.Editor {
    charts: Chart[] = []
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

    //refs
    recordButton: HTMLElement
    recordIcon: HTMLElement
    consoleRoot: HTMLElement
    chartRoot: HTMLElement

    getId() {
        return "serialEditor"
    }

    hasEditorToolbar() {
        return false
    }

    setVisible(b: boolean) {
        this.isVisible = b;
        if (this.isVisible) this.startRecording()
        else this.pauseRecording();
    }

    acceptsFile(file: pkg.File) {
        return file.name === pxt.SERIAL_EDITOR_FILE;
    }

    setSim(b: boolean) {
        this.isSim = b
        this.clear()
    }

    constructor(public parent: pxt.editor.IProjectView) {
        super(parent)
        //TODO take out the .bind(this)?
        window.addEventListener("message", this.processMessage.bind(this), false)
    }

    processMessage(ev: MessageEvent) {
        let msg = ev.data
        if (!this.active || msg.type !== "serial") return;

        //TODO y tho
        const smsg = msg as pxsim.SimulatorSerialMessage
        const sim = !!smsg.sim
        if (sim != this.isSim) return;

        const data = smsg.data || ""
        const source = smsg.id || "?"
        //TODO not using theme anymore
        let theme = source.split("-")[0] || "black"

        //TODO incorporate source?
        this.appendRawData(data)

        const m = /^\s*(([^:]+):)?\s*(-?\d+(\.\d*)?)/i.exec(data);
        if (m) {
            const variable = m[2] || '';
            const nvalue = parseFloat(m[3]);
            if (!isNaN(nvalue)) {
                this.appendGraphEntry(source, theme, sim, variable, nvalue)
                return;
            }
        }

        //TODO incorporate source?
        this.appendConsoleEntry(data)
    }

    appendRawData(data: string) {
        this.rawDataBuffer += data
        let excessChars = this.rawDataBuffer.length - this.maxBufferLength
        if (excessChars > 0) {
            this.rawDataBuffer = this.rawDataBuffer.slice(excessChars)
        }
    }

    appendGraphEntry(source: string, theme: string, sim: boolean, variable: string, nvalue: number) {
        //See if there is a "home chart" that this point belongs to -
        //if not, create a new chart
        let homeChart: Chart = undefined
        for (let i = 0; i < this.charts.length; ++i) {
            let chart = this.charts[i]
            if (chart.shouldContain(source, variable)) {
                homeChart = chart
                break
            }
        }
        if (homeChart) {
            homeChart.addPoint(nvalue)
        } else {
            let newChart = new Chart(source, variable, nvalue, this.chartIdx)
            this.chartIdx++
            this.charts.push(newChart)
            let serialChartRoot = document.getElementById("serialCharts")
            serialChartRoot.appendChild(newChart.getElement())
        }
    }

    appendConsoleEntry(data: string) {
        for (let i = 0; i < data.length; ++i) {
            let ch = data[i]
            this.consoleBuffer += ch
            if (ch === "\n" || this.consoleBuffer.length > this.maxConsoleLineLength) {

                let lastEntry = this.consoleRoot.lastChild
                let newEntry = document.createElement("div")
                if (lastEntry && lastEntry.lastChild.textContent == this.consoleBuffer) {
                    if (lastEntry.childNodes.length == 2) {
                        //matches already-collapsed entry
                        let count = parseInt(lastEntry.firstChild.textContent)
                        lastEntry.firstChild.textContent = (count + 1).toString()
                    } else {
                        //make a new collapsed entry with count = 2
                        let newLabel = document.createElement("a")
                        newLabel.className = "ui horizontal label"
                        newLabel.textContent = "2"
                        lastEntry.insertBefore(newLabel, lastEntry.lastChild)
                    }
                } else {
                    //make a new non-collapsed entry
                    newEntry.appendChild(document.createTextNode(this.consoleBuffer))
                    this.consoleRoot.appendChild(newEntry)
                    this.consoleRoot.scrollTop = this.consoleRoot.scrollHeight
                }
                if (this.consoleRoot.childElementCount > this.maxConsoleEntries) {
                    this.consoleRoot.removeChild(this.consoleRoot.firstChild)
                }
                this.consoleBuffer = ""
            }
        }
    }

    pauseRecording() {
        this.active = false
        if (this.recordIcon) this.recordIcon.className = "circle icon"
        if (this.recordButton) {
            this.recordButton.classList.remove("green")
            this.recordButton.classList.add("circular")
            this.recordButton.classList.add("red")
        }
        this.charts.forEach(s => s.stop())
    }

    startRecording() {
        this.active = true
        if (this.recordIcon) this.recordIcon.className = "pause icon"
        if (this.recordButton) {
            this.recordButton.classList.remove("red")
            this.recordButton.classList.remove("circular")
            this.recordButton.classList.add("green")
        }
        this.charts.forEach(s => s.start())
    }

    toggleRecording() {
        pxt.tickEvent("serial.toggleRecording")
        if (this.active) this.pauseRecording()
        else this.startRecording()
    }

    clearNode(e: HTMLElement) {
        while (e.hasChildNodes()) {
            e.removeChild(e.firstChild)
        }
    }

    clear() {
        //TODO use refs
        let chartRoot = document.getElementById("serialCharts")
        let consoleRoot = document.getElementById("serialConsole")
        this.clearNode(chartRoot)
        this.clearNode(consoleRoot)
        this.charts = []
        this.consoleBuffer = ""
    }

    entriesToPlaintext() {
        return this.rawDataBuffer
    }

    entriesToCSV() {
        let csv = this.charts.map(chart => `time (s), ${chart.variable} (${chart.source})`).join(', ') + '\r\n';
        const datas = this.charts.map(chart => chart.line.data);
        const nl = datas.map(data => data.length).reduce((l, c) => Math.max(l, c));
        const nc = this.charts.length;
        for (let i = 0; i < nl; ++i) {
            csv += datas.map(data => i < data.length ? `${(data[i][0] - data[0][0]) / 1000}, ${data[i][1]}` : ' , ').join(', ');
            csv += '\r\n';
        }
        return csv;
    }

    showExportDialog() {
        pxt.tickEvent("serial.showExportDialog")
        const targetTheme = pxt.appTarget.appTheme
        let rootUrl = targetTheme.embedUrl
        if (!rootUrl) {
            pxt.commands.browserDownloadAsync(this.entriesToPlaintext(), "data.txt", "text/plain")
            return
        }
        if (!/\/$/.test(rootUrl)) rootUrl += '/'

        core.confirmAsync({
            logos: undefined,
            header: lf("Analyze Data"),
            hideAgree: true,
            disagreeLbl: lf("Close"),
            onLoaded: (_) => {
                _.find('#datasavecsvfile').click(() => {
                    pxt.tickEvent("serial.dataExported.csv")
                    _.modal('hide')
                    pxt.commands.browserDownloadAsync(this.entriesToCSV(), "data.csv", "text/csv")
                })
                _.find('#datasavetxtfile').click(() => {
                    pxt.tickEvent("serial.dataExported.txt")
                    _.modal('hide')
                    pxt.commands.browserDownloadAsync(this.entriesToPlaintext(), "data.txt", "text/plain")
                })
            },
            htmlBody:
            `<div></div>
                <div class="ui cards" role="listbox">
                    <div  id="datasavecsvfile" class="ui link card">
                        <div class="content">
                            <div class="header">${lf("CSV File")}</div>
                            <div class="description">
                                ${lf("Save the chart data streams.")}
                            </div>
                        </div>
                        <div class="ui bottom attached button">
                            <i class="download icon"></i>
                            ${lf("Download")}
                        </div>
                    </div>
                    <div id="datasavetxtfile" class="ui link card">
                        <div class="content">
                            <div class="header">${lf("Text File")}</div>
                            <div class="description">
                                ${lf("Save the text output.")}
                            </div>
                        </div>
                        <div class="ui bottom attached button">
                            <i class="download icon"></i>
                            ${lf("Download")}
                        </div>
                    </div>
                </div>`
        }).done()
    }

    goBack() {
        //TODO tight coupling
        pxt.tickEvent("serial.backButton")
        this.parent.openPreviousEditor()
    }

    display() {
        return (
            <div id="serialArea">
                <div id="serialHeader" className="ui">
                    <div className="leftHeaderWrapper">
                        <div className="leftHeader">
                            <button ref={e => this.recordButton = e} className={`ui left floated icon button ${this.active ? "green" : "red circular"} toggleRecord`} onClick={this.toggleRecording.bind(this)}>
                                <i ref={e => this.recordIcon = e} className={this.active ? "pause icon" : "circle icon"}></i>
                            </button>
                            <span className="ui small header">{this.isSim ? lf("Simulator") : lf("Device")}</span>
                        </div>
                    </div>
                    <div className="rightHeader">
                        <button className="ui icon circular small inverted button" onClick={this.goBack.bind(this)}>
                            <i className="close icon"></i>
                        </button>
                    </div>
                </div>
                <div id="serialCharts" ref={e => this.chartRoot = e}></div>
                <div className="ui fitted divider"></div>
                <div id="serialConsole" ref={e => this.consoleRoot = e}></div>
                <div id="serialToolbox">
                    <div className="ui grid right aligned padded">
                        <div className="column">
                            <button className="ui small basic blue button" onClick={this.showExportDialog.bind(this)}>
                                <i className="download icon"></i> {lf("Export data")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    domUpdate() {
    }
}

class Chart {
    rootElement: HTMLElement = document.createElement("div")
    canvas: HTMLCanvasElement = undefined
    line: TimeSeries = new TimeSeries();
    source: string;
    variable: string;
    chart: SmoothieChart;
    lineConfigs = [
        { strokeStyle: 'rgba(255, 0, 0, 1)', fillStyle: 'rgba(255, 0, 0, 0.5)', lineWidth: 5 },
        { strokeStyle: 'rgba(0, 0, 255, 1)', fillStyle: 'rgba(0, 0, 255, 0.5)', lineWidth: 5 },
        { strokeStyle: 'rgba(0, 255, 0, 1)', fillStyle: 'rgba(0, 255, 0, 0.5)', lineWidth: 5 },
        { strokeStyle: 'rgba(255, 255, 0, 1)', fillStyle: 'rgba(255, 255, 0, 0.5)', lineWidth: 5 }
    ]

    constructor(source: string, variable: string, value: number, chartIdx: number) {
        const serialTheme = pxt.appTarget.serial && pxt.appTarget.serial.editorTheme
        // Initialize chart
        const chartConfig = {
            interpolation: 'bezier',
            responsive: true,
            millisPerPixel: 20,
            grid: {
                verticalSections: 0,
                borderVisible: false,
                fillStyle: serialTheme && serialTheme.backgroundColor || '#fff',
                strokeStyle: serialTheme && serialTheme.backgroundColor || '#fff'
            }
        }
        this.chart = new SmoothieChart(chartConfig)
        this.rootElement.className = "ui segment"
        this.source = source
        this.variable = variable
        this.chart.addTimeSeries(this.line, this.lineConfigs[chartIdx % 4])

        if (this.variable)
            this.rootElement.appendChild(this.makeLabel())
        this.rootElement.appendChild(this.makeCanvas())
        this.addPoint(value)
    }

    makeLabel() {
        let label = document.createElement("div")
        label.className = "ui orange bottom left attached label seriallabel"
        label.innerText = this.variable
        return label
    }

    makeCanvas() {
        let canvas = document.createElement("canvas");
        this.chart.streamTo(canvas);
        this.canvas = canvas;
        this.canvas.addEventListener("click", ev => {
            pxt.commands.browserDownloadAsync(this.toCSV(), "data.csv", "text/csv")
        }, false);
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
        this.line.append(Util.now(), value)
    }

    start() {
        this.chart.start()
    }

    stop() {
        this.chart.stop()
    }

    toCSV(): string {
        const data = this.line.data;
        if (data.length == 0) return '';
        const t0 = data[0][0];
        return `time (s), ${this.variable}, ${lf("Tip: Insert a Scatter Chart to visualize this data.")}\r\n` +
            data.map(row => ((row[0] - t0) / 1000) + ", " + row[1]).join('\r\n');
    }
}