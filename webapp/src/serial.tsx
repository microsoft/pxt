/// <reference path="../../localtypings/smoothie.d.ts" />

import * as React from "react"
import * as pkg from "./package"
import * as core from "./core"
import * as srceditor from "./srceditor"
import * as sui from "./sui"
import * as codecard from "./codecard"
import * as data from "./data";

import Cloud = pxt.Cloud
import Util = pxt.Util

const lf = Util.lf
const maxEntriesPerChart: number = 4000;

export class Editor extends srceditor.Editor {
    savedMessageQueue: pxsim.SimulatorSerialMessage[] = []
    maxSavedMessages: number = 100
    charts: Chart[] = []
    chartIdx: number = 0
    sourceMap: pxt.Map<string> = {}
    consoleBuffer: string = ""
    isSim: boolean = true
    maxConsoleLineLength: number = 255
    maxConsoleEntries: number = 100
    active: boolean = true
    rawDataBuffer: string = ""
    maxBufferLength: number = 10000;
    csvHeaders: string[] = [];

    lineColors = ["#f00", "#00f", "#0f0", "#ff0"]
    hcLineColors = ["000"]
    currentLineColors = this.lineColors
    highContrast: boolean = false

    //refs
    startPauseButton: StartPauseButton
    consoleRoot: HTMLElement
    chartRoot: HTMLElement

    getId() {
        return "serialEditor"
    }

    hasHistory() { return false; }

    hasEditorToolbar() {
        return false
    }

    setVisible(b: boolean) {
        if (this.parent.state.highContrast !== this.highContrast) {
            this.setHighContrast(this.parent.state.highContrast)
        }
        this.isVisible = b
        if (this.isVisible) {
            this.processQueuedMessages()
            this.startRecording()
        }
        else {
            this.pauseRecording()
            this.clear()
        }
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

    acceptsFile(file: pkg.File) {
        return file.name === pxt.SERIAL_EDITOR_FILE;
    }

    setSim(b: boolean) {
        if (this.isSim != b) {
            this.isSim = b
            this.clear()
        }
    }

    constructor(public parent: pxt.editor.IProjectView) {
        super(parent)
        window.addEventListener("message", this.processEvent.bind(this), false)
        const serialTheme = pxt.appTarget.serial && pxt.appTarget.serial.editorTheme
        this.lineColors = (serialTheme && serialTheme.lineColors) || this.lineColors
    }

    saveMessageForLater(m: pxsim.SimulatorSerialMessage) {
        this.savedMessageQueue.push(m);
        if (this.savedMessageQueue.length > this.maxSavedMessages) {
            this.savedMessageQueue.shift();
        }
    }

    processQueuedMessages() {
        this.savedMessageQueue.forEach(m => this.processMessage(m));
        this.savedMessageQueue = [];
    }

    processEvent(ev: MessageEvent) {
        let msg = ev.data
        if (msg.type !== "serial") return;
        const smsg = msg as pxsim.SimulatorSerialMessage

        smsg.receivedTime = smsg.receivedTime || Util.now();
        if (!this.active) {
            this.saveMessageForLater(smsg);
            return;
        }
        this.processMessage(smsg);
    }

    processMessage(smsg: pxsim.SimulatorSerialMessage) {
        const sim = !!smsg.sim
        if (sim != this.isSim) return;

        const data = smsg.data || ""
        const source = smsg.id || "?"
        const receivedTime = smsg.receivedTime || Util.now()

        this.appendRawData(data);

        if (!this.sourceMap[source]) {
            const sourceIdx = Object.keys(this.sourceMap).length + 1
            this.sourceMap[source] = lf("source") + sourceIdx.toString()
        }
        const niceSource = this.sourceMap[source]

        // is this a CSV data entry
        if (/^\s*(-?\d+(\.\d*)?)(\s*,\s*(-?\d+(\.\d*)?))+\s*,?\s*$/.test(data)) {
            const parts = data.split(/\s*,\s*/).map(s => parseFloat(s))
                .filter(d => !isNaN(d))
                .forEach((d, i) => {
                    const variable = "data." + (this.csvHeaders[i] || i);
                    this.appendGraphEntry(niceSource, variable, d, receivedTime);
                })
            // is this a CSV header entry
        } else if (/^\s*[\s\w]+(\s*,\s*[\w\s]+)+\s*,?\s*$/.test(data)) {
            this.csvHeaders = data.split(/\s*,\s*/).map(h => h.trim());
        }
        else {
            // is this a key-value pair, or just a number?
            const m = /^\s*(([^:]+):)?\s*(-?\d+(\.\d*)?)/i.exec(data);
            if (m) {
                const variable = m[2] || '';
                const nvalue = parseFloat(m[3]);
                if (!isNaN(nvalue)) {
                    this.appendGraphEntry(niceSource, variable, nvalue, receivedTime)
                }
            }
        }

        this.appendConsoleEntry(data)
    }

    appendRawData(data: string) {
        this.rawDataBuffer += data;
        if (this.rawDataBuffer.length > this.maxBufferLength) {
            this.rawDataBuffer.slice(this.rawDataBuffer.length / 4);
        }
    }

    appendGraphEntry(source: string, variable: string, nvalue: number, receivedTime: number) {
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
        if (!homeChart) {
            homeChart = new Chart(source, variable, this.chartIdx, this.currentLineColors)
            this.chartIdx++;
            this.charts.push(homeChart)
            this.chartRoot.appendChild(homeChart.getElement());
        }
        homeChart.addPoint(variable, nvalue, receivedTime)
    }

    appendConsoleEntry(data: string) {
        for (let i = 0; i < data.length; ++i) {
            let ch = data[i]
            this.consoleBuffer += ch
            if (ch !== "\n" && this.consoleBuffer.length < this.maxConsoleLineLength) {
                continue
            }
            if (ch === "\n") {
                // remove trailing white space
                this.consoleBuffer = this.consoleBuffer.replace(/\s+$/, '');
                // if anything remaining...
                if (this.consoleBuffer.length) {
                    let lastEntry = this.consoleRoot.lastChild
                    let newEntry = document.createElement("div")
                    if (lastEntry && lastEntry.lastChild.textContent == this.consoleBuffer) {
                        if (lastEntry.childNodes.length == 2) {
                            //Matches already-collapsed entry
                            let count = parseInt(lastEntry.firstChild.textContent)
                            lastEntry.firstChild.textContent = (count + 1).toString()
                        } else {
                            //Make a new collapsed entry with count = 2
                            let newLabel = document.createElement("a")
                            newLabel.className = "ui horizontal label"
                            newLabel.textContent = "2"
                            lastEntry.insertBefore(newLabel, lastEntry.lastChild)
                        }
                    } else {
                        //Make a new non-collapsed entry
                        newEntry.appendChild(document.createTextNode(this.consoleBuffer))
                        this.consoleRoot.appendChild(newEntry)
                    }
                }
            } else {
                //Buffer is full
                //Make a new entry with <span>, not <div>
                let newEntry = document.createElement("span")
                newEntry.appendChild(document.createTextNode(this.consoleBuffer))
                this.consoleRoot.appendChild(newEntry)
            }
            this.consoleBuffer = ""
            this.consoleRoot.scrollTop = this.consoleRoot.scrollHeight
            while (this.consoleRoot.childElementCount > this.maxConsoleEntries) {
                this.consoleRoot.removeChild(this.consoleRoot.firstChild)
            }
            if (this.consoleRoot && this.consoleRoot.childElementCount > 0) {
                if (this.chartRoot) this.chartRoot.classList.remove("noconsole");
                if (this.consoleRoot) this.consoleRoot.classList.remove("noconsole");
            }
        }
    }

    pauseRecording() {
        this.active = false
        if (this.startPauseButton) this.startPauseButton.setState({ active: this.active });
        this.charts.forEach(s => s.stop())
    }

    startRecording() {
        this.active = true
        if (this.startPauseButton) this.startPauseButton.setState({ active: this.active });
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
        if (this.chartRoot) this.clearNode(this.chartRoot)
        if (this.clearNode) this.clearNode(this.consoleRoot)
        if (this.chartRoot) {
            this.clearNode(this.chartRoot);
            this.chartRoot.classList.add("noconsole")
        }
        if (this.consoleRoot) {
            this.clearNode(this.consoleRoot);
            this.consoleRoot.classList.add("noconsole")
        }
        this.charts = []
        this.consoleBuffer = ""
        this.rawDataBuffer = ""
        this.savedMessageQueue = []
        this.sourceMap = {}
        this.csvHeaders = [];
    }

    isCSV(nl: number, datas: number[][][]): boolean {
        if (datas.length < 2) return false;
        for (let i = 0; i < datas.length; ++i)
            if (datas[i].length != nl) return false;

        for (let l = 0; l < nl; ++l) {
            let t = datas[0][l][0];
            for (let d = 1; d < datas.length; ++d) {
                if (datas[d][l][0] != t)
                    return false;
            }
        }

        return true;
    }

    downloadCSV() {
        const sep = lf("{id:csvseparator}\t");
        let csv: string[] = [];

        const hasData = this.charts.length && this.charts.some((chart) => {
            return Object.keys(chart.datas).length > 0;
        });

        if (!hasData) {
            core.confirmAsync({
                header: lf("No data to export"),
                hideAgree: true,
                disagreeLbl: lf("Ok"),
                body: lf("You must generate some serial data before you can export it.")
            });
            return;
        }

        this.charts.forEach(chart => {
            const lines: { name: string; line: number[][]; }[] = [];
            Object.keys(chart.datas).forEach(k => lines.push({ name: k, line: chart.datas[k] }));
            const datas = lines.map(line => line.line);
            const nl = datas.length > 0 ? datas.map(data => data.length).reduce((l, c) => Math.max(l, c)) : 0;
            // if all lines have same timestamp, condense output
            let isCSV = this.isCSV(nl, datas);
            if (isCSV) {
                let h = `time (${chart.source})${sep}` + lines.map(line => line.name).join(sep) + sep;
                csv[0] = csv[0] ? csv[0] + sep + h : h;
                for (let i = 0; i < nl; ++i) {
                    const t = (datas[0][i][0] - datas[0][0][0]) / 1000;
                    const da = t + sep + datas.map(data => data[i][1]).join(sep) + sep;
                    csv[i + 1] = csv[i + 1] ? csv[i + 1] + sep + da : da;
                }
            } else {
                let h = lines.map(line => `time (${chart.source})${sep}${line.name}`).join(sep);
                csv[0] = csv[0] ? csv[0] + sep + h : h;
                for (let i = 0; i < nl; ++i) {
                    const da = datas.map(data => i < data.length ? `${(data[i][0] - data[0][0]) / 1000}${sep}${data[i][1]}` : sep).join(sep);
                    csv[i + 1] = csv[i + 1] ? csv[i + 1] + sep + da : da;
                }
            }
        });

        csv.unshift(`sep=${sep}`)
        const csvText = csv.join('\r\n');

        core.infoNotification(lf("Exporting data...."));
        const time = new Date(Date.now()).toString().replace(/[^\d]+/g, '-').replace(/(^-|-$)/g, '');
        pxt.commands.browserDownloadAsync(csvText, pxt.appTarget.id + '-' + lf("{id:csvfilename}data") + '-' + time + ".csv", "text/csv")
    }

    downloadRaw() {
        core.infoNotification(lf("Exporting text...."));
        const time = new Date(Date.now()).toString().replace(/[^\d]+/g, '-').replace(/(^-|-$)/g, '');
        pxt.commands.browserDownloadAsync(this.rawDataBuffer, pxt.appTarget.id + '-' + lf("{id:csvfilename}console") + '-' + time + ".txt", "text/plain")
    }

    goBack() {
        pxt.tickEvent("serial.backButton", undefined, { interactiveConsent: true })
        this.parent.openPreviousEditor()
    }

    display() {
        return (
            <div id="serialArea">
                <div id="serialHeader" className="ui serialHeader">
                    <div className="leftHeaderWrapper">
                        <div className="leftHeader">
                            <sui.Button title={lf("Go back")} class="ui icon circular small button editorBack" ariaLabel={lf("Go back")} onClick={this.goBack.bind(this)}>
                                <sui.Icon icon="arrow left" />
                            </sui.Button>
                        </div>
                    </div>
                    <div className="rightHeader">
                        <sui.Button title={lf("Export data")} class="ui icon blue button editorExport" ariaLabel={lf("Export data")} onClick={() => this.downloadCSV()}>
                            <sui.Icon icon="download" />
                        </sui.Button>
                        <StartPauseButton ref={e => this.startPauseButton = e} active={this.active} toggle={this.toggleRecording.bind(this)} />
                        <span className="ui small header">{this.isSim ? lf("Simulator") : lf("Device")}</span>
                    </div>
                </div>
                <div id="serialCharts" ref={e => this.chartRoot = e}></div>
                <div id="consoleHeader" className="ui serialHeader">
                    <div className="rightHeader">
                        <sui.Button title={lf("Copy text")} class="ui icon button editorExport" ariaLabel={lf("Copy text")} onClick={() => this.downloadRaw()}>
                            <sui.Icon icon="copy" />
                        </sui.Button>
                    </div>
                </div>
                <div id="serialConsole" ref={e => this.consoleRoot = e}></div>
            </div>
        )
    }

    domUpdate() {
    }
}

export interface StartPauseButtonProps {
    active?: boolean;
    toggle?: () => void;
}

export interface StartPauseButtonState {
    active?: boolean;
}

export class StartPauseButton extends data.Component<StartPauseButtonProps, StartPauseButtonState> {
    constructor(props: StartPauseButtonProps) {
        super(props);
        this.state = {
            active: this.props.active
        }
    }

    renderCore() {
        const { toggle } = this.props;
        const { active } = this.state;

        return <sui.Button title={active ? lf("Pause recording") : lf("Start recording")} class={`ui left floated icon button ${active ? "green" : "red circular"} toggleRecord`} onClick={toggle}>
            <sui.Icon icon={active ? "pause icon" : "circle icon"} />
        </sui.Button>
    }
}

class Chart {
    rootElement: HTMLElement = document.createElement("div")
    lineColors: string[];
    chartIdx: number;
    canvas: HTMLCanvasElement;
    label: HTMLDivElement;
    lines: pxt.Map<TimeSeries> = {};
    datas: pxt.Map<number[][]> = {};
    source: string;
    variable: string;
    chart: SmoothieChart;

    constructor(source: string, variable: string, chartIdx: number, lineColors: string[]) {
        const serialTheme = pxt.appTarget.serial && pxt.appTarget.serial.editorTheme
        // Initialize chart
        const chartConfig: IChartOptions = {
            interpolation: 'bezier',
            labels: {
                disabled: false,
                fillStyle: 'black',
                fontSize: 14
            },
            responsive: true,
            millisPerPixel: 20,
            grid: {
                verticalSections: 0,
                borderVisible: false,
                millisPerLine: 5000,
                fillStyle: serialTheme && serialTheme.gridFillStyle || 'transparent',
                strokeStyle: serialTheme && serialTheme.gridStrokeStyle || '#fff'
            },
            tooltip: true,
            tooltipFormatter: (ts, data) => this.tooltip(ts, data)
        }
        this.lineColors = lineColors;
        this.chartIdx = chartIdx;
        this.chart = new SmoothieChart(chartConfig);
        this.rootElement.className = "ui segment";
        this.source = source;
        this.variable = variable.replace(/\..*$/, ''); // keep prefix only

        this.rootElement.appendChild(this.makeLabel())
        this.rootElement.appendChild(this.makeCanvas())
    }

    tooltip(timestamp: number, data: { series: TimeSeries, index: number, value: number }[]): string {
        return data.map(n => {
            const name = (n.series as any).timeSeries.__name;
            return `<span>${name ? name + ': ' : ''}${n.value}</span>`;
        }).join('<br/>');
    }

    getLine(name: string): TimeSeries {
        let line = this.lines[name];
        if (!line) {
            const lineColor = this.lineColors[this.chartIdx++ % this.lineColors.length]
            this.lines[name] = line = new TimeSeries();
            (line as any).__name = Util.htmlEscape(name.substring(this.variable.length + 1));
            this.chart.addTimeSeries(line, {
                strokeStyle: lineColor,
                lineWidth: 3
            })
            this.datas[name] = [];
        }
        return line;
    }

    makeLabel() {
        this.label = document.createElement("div")
        this.label.className = "ui orange bottom left attached no-select label seriallabel"
        this.label.innerText = this.variable || "...";
        return this.label;
    }

    makeCanvas() {
        let canvas = document.createElement("canvas");
        this.chart.streamTo(canvas);
        this.canvas = canvas;
        return canvas
    }

    getCanvas() {
        return this.canvas
    }

    getElement() {
        return this.rootElement
    }

    shouldContain(source: string, variable: string) {
        return this.source == source
            && this.variable == variable.replace(/\..*$/, '');
    }

    addPoint(name: string, value: number, timestamp: number) {
        const line = this.getLine(name);
        line.append(timestamp, value)
        if (Object.keys(this.lines).length == 1) {
            // update label with last value
            const valueText = Number(Math.round(Number(value + "e+2")) + "e-2").toString();
            this.label.innerText = this.variable ? `${this.variable}: ${valueText}` : valueText;
        } else {
            this.label.innerText = this.variable || '';
        }
        // store data
        const data = this.datas[name];
        data.push([timestamp, value]);
        // remove a third of the card
        if (data.length > maxEntriesPerChart)
            data.splice(0, data.length / 4);
    }

    start() {
        this.chart.start()
    }

    stop() {
        this.chart.stop()
    }
}