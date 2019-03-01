/// <reference path="../../localtypings/smoothie.d.ts" />

import * as React from "react"
import * as pkg from "./package"
import * as core from "./core"
import * as srceditor from "./srceditor"
import * as sui from "./sui"
import * as data from "./data";

import Util = pxt.Util

const maxEntriesPerChart: number = 4000;

export class Editor extends srceditor.Editor {
    savedMessageQueue: pxsim.SimulatorSerialMessage[] = []
    maxSavedMessages: number = 1000;
    charts: Chart[] = []
    chartIdx: number = 0
    sourceMap: pxt.Map<string> = {}
    serialInputDataBuffer: string = ""
    maxSerialInputDataLength: number = 255;
    isSim: boolean = true
    maxConsoleEntries: number = 500;
    active: boolean = true
    rawDataBuffer: string = ""
    maxBufferLength: number = 10000;
    csvHeaders: string[] = [];

    lineColors: string[];
    hcLineColors: string[];
    currentLineColors: string[];
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
        const serialTheme = pxt.appTarget.serial && pxt.appTarget.serial.editorTheme;
        this.lineColors = (serialTheme && serialTheme.lineColors) || ["#e00", "#00e", "#0e0"];
        this.hcLineColors = ["#000"];
        this.currentLineColors = this.lineColors;

        this.goBack = this.goBack.bind(this);
        this.toggleRecording = this.toggleRecording.bind(this);
        this.downloadRaw = this.downloadRaw.bind(this);
        this.downloadCSV = this.downloadCSV.bind(this);
    }

    private loadSmoothieChartsPromise: Promise<void>
    private loadSmoothieChartsAsync(): Promise<void> {
        if (!this.loadSmoothieChartsPromise) {
            this.loadSmoothieChartsPromise = pxt.BrowserUtils.loadScriptAsync("smoothie/smoothie_compressed.js");
        }
        return this.loadSmoothieChartsPromise;
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
        smsg.receivedTime = smsg.receivedTime || Util.now();
        if (!this.active) {
            this.saveMessageForLater(smsg);
            return;
        }
        this.processMessage(smsg);
    }

    mapSource(source: string): string {
        if (!this.sourceMap[source]) {
            const sourceIdx = Object.keys(this.sourceMap).length + 1
            this.sourceMap[source] = lf("source") + sourceIdx.toString()
        }
        return this.sourceMap[source]
    }

    processMessage(smsg: pxsim.SimulatorSerialMessage) {
        const sim = !!smsg.sim
        if (sim != this.isSim) return;

        // clean up input
        const data = smsg.data || ""
        const source = smsg.id || "?"
        const receivedTime = smsg.receivedTime || Util.now()

        this.appendRawData(data);
        const niceSource = this.mapSource(source);


        // chunk into lines
        const lines = this.chunkDataIntoLines(data)

        // process each line
        for (const line of lines) {
            this.processMessageLine(line, niceSource, receivedTime);
        }
    }

    processMessageLine(line: string, niceSource: string, receivedTime: number) {
        // packet payload as json
        if (/^\s*\{[^}]+\}\s*$/.test(line)) {
            try {
                const json = JSON.parse(line);
                const t = parseInt(json["t"]);
                const s = this.mapSource(json["s"]);
                const n = json["n"] || "";
                const v = parseFloat(json["v"]);
                if (!isNaN(t) && !isNaN(v))
                    this.appendGraphEntry(s, n, v, receivedTime);
            }
            catch (e) { } // invalid js
        }
        // is this a CSV data entry
        else if (/^\s*(-?\d+(\.\d*)?(e[\+\-]\d+)?)(\s*,\s*(-?\d+(\.\d*)?(e[\+\-]\d+)?))+\s*,?\s*$/.test(line)) {
            line.split(/\s*,\s*/).map(s => parseFloat(s))
                .filter(d => !isNaN(d))
                .forEach((d, i) => {
                    const variable = "data." + (this.csvHeaders[i] || i);
                    this.appendGraphEntry(niceSource, variable, d, receivedTime);
                })
            // is this a CSV header entry
        } else if (/^\s*[\s\w]+(\s*,\s*[\w\s]+)+\s*,?\s*$/.test(line)) {
            this.csvHeaders = line.split(/\s*,\s*/).map(h => h.trim());
        }
        else {
            // is this a key-value pair, or just a number?
            const m = /^\s*(([^:]+):)?\s*(-?\d+(\.\d*)?(e[\+\-]\d+)?)/i.exec(line);
            if (m) {
                const variable = m[2] || '';
                const nvalue = parseFloat(m[3]);
                if (!isNaN(nvalue)) {
                    this.appendGraphEntry(niceSource, variable, nvalue, receivedTime)
                }
            }
        }

        this.appendConsoleEntry(line)
    }

    appendRawData(data: string) {
        this.rawDataBuffer += data;
        if (this.rawDataBuffer.length > this.maxBufferLength) {
            this.rawDataBuffer.slice(this.rawDataBuffer.length / 4);
        }
    }

    appendGraphEntry(source: string, variable: string, nvalue: number, receivedTime: number) {
        this.loadSmoothieChartsAsync()
            .then(() => {
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
                    this.chartRoot.classList.remove("nochart");
                    if (this.consoleRoot) this.consoleRoot.classList.remove("nochart");
                }
                homeChart.addPoint(variable, nvalue, receivedTime)
            })
    }

    chunkDataIntoLines(data: string): string[] {
        let lines: string[] = []
        for (let i = 0; i < data.length; ++i) {
            const ch = data[i]
            this.serialInputDataBuffer += ch
            if (ch !== "\n" && this.serialInputDataBuffer.length < this.maxSerialInputDataLength) {
                continue
            }
            if (ch === "\n") {
                // remove trailing white space
                this.serialInputDataBuffer = this.serialInputDataBuffer.replace(/\s+$/, '');
                // if anything remaining...
                if (this.serialInputDataBuffer.length) {
                    lines.push(this.serialInputDataBuffer)
                }
            } else {
                lines.push(this.serialInputDataBuffer)
            }
            this.serialInputDataBuffer = ""
        }
        return lines
    }

    appendConsoleEntry(line: string) {
        if (line.length >= this.maxSerialInputDataLength) {
            //Buffer was full, this is a big chunk of data
            //Make a new entry with <span>, not <div>
            let newEntry = document.createElement("span")
            newEntry.appendChild(document.createTextNode(line))
            this.consoleRoot.appendChild(newEntry)
        }
        else {
            let lastEntry = this.consoleRoot.lastChild
            let newEntry = document.createElement("div")
            if (lastEntry && lastEntry.lastChild.textContent == line) {
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
                newEntry.appendChild(document.createTextNode(line))
                this.consoleRoot.appendChild(newEntry)
            }
        }
        this.consoleRoot.scrollTop = this.consoleRoot.scrollHeight
        while (this.consoleRoot.childElementCount > this.maxConsoleEntries) {
            this.consoleRoot.removeChild(this.consoleRoot.firstChild)
        }
        if (this.consoleRoot && this.consoleRoot.childElementCount > 0) {
            if (this.chartRoot) this.chartRoot.classList.remove("noconsole");
            if (this.consoleRoot) this.consoleRoot.classList.remove("noconsole");
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
        pxt.tickEvent("serial.toggleRecording", undefined, { interactiveConsent: true })
        if (this.active) this.pauseRecording()
        else this.startRecording()
    }

    clearNode(e: HTMLElement) {
        while (e.hasChildNodes()) {
            e.removeChild(e.firstChild)
        }
    }

    clear() {
        if (this.chartRoot) {
            this.clearNode(this.chartRoot);
            this.chartRoot.classList.add("noconsole")
            this.chartRoot.classList.add("nochart")
        }
        if (this.consoleRoot) {
            this.clearNode(this.consoleRoot);
            this.consoleRoot.classList.add("noconsole")
            this.consoleRoot.classList.add("nochart")
        }
        this.charts = []
        this.serialInputDataBuffer = ""
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
        pxt.commands.browserDownloadAsync(Util.toUTF8(csvText), pxt.appTarget.id + '-' + lf("{id:csvfilename}data") + '-' + time + ".csv", "text/csv")
    }

    downloadRaw() {
        core.infoNotification(lf("Exporting text...."));
        const time = new Date(Date.now()).toString().replace(/[^\d]+/g, '-').replace(/(^-|-$)/g, '');
        pxt.commands.browserDownloadAsync(Util.toUTF8(this.rawDataBuffer), pxt.appTarget.id + '-' + lf("{id:csvfilename}console") + '-' + time + ".txt", "text/plain")
    }

    goBack() {
        pxt.tickEvent("serial.backButton", undefined, { interactiveConsent: true })
        this.parent.openPreviousEditor()
    }

    handleStartPauseRef = (c: any) => {
        this.startPauseButton = c;
    }

    handleChartRootRef = (c: any) => {
        this.chartRoot = c;
    }

    handleConsoleRootRef = (c: any) => {
        this.consoleRoot = c;
    }

    display() {
        return (
            <div id="serialArea">
                <div id="serialHeader" className="ui serialHeader">
                    <div className="leftHeaderWrapper">
                        <div className="leftHeader">
                            <sui.Button title={lf("Go back")} tabIndex={0} onClick={this.goBack} onKeyDown={sui.fireClickOnEnter}>
                                <sui.Icon icon="arrow left" />
                                <span className="ui text landscape only">{lf("Go back")}</span>
                            </sui.Button>
                        </div>
                    </div>
                    <div className="rightHeader">
                        <sui.Button title={lf("Copy text")} className="ui icon button editorExport" ariaLabel={lf("Copy text")} onClick={this.downloadRaw}>
                            <sui.Icon icon="copy" />
                        </sui.Button>
                        <sui.Button title={lf("Export data")} className="ui icon blue button editorExport" ariaLabel={lf("Export data")} onClick={this.downloadCSV}>
                            <sui.Icon icon="download" />
                        </sui.Button>
                        <StartPauseButton ref={this.handleStartPauseRef} active={this.active} toggle={this.toggleRecording} />
                        <span className="ui small header">{this.isSim ? lf("Simulator") : lf("Device")}</span>
                    </div>
                </div>
                <div id="serialCharts" ref={this.handleChartRootRef}></div>
                <div id="serialConsole" ref={this.handleConsoleRootRef}></div>
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

export class StartPauseButton extends data.PureComponent<StartPauseButtonProps, StartPauseButtonState> {
    constructor(props: StartPauseButtonProps) {
        super(props);
        this.state = {
            active: this.props.active
        }
    }

    renderCore() {
        const { toggle } = this.props;
        const { active } = this.state;

        return <sui.Button title={active ? lf("Pause recording") : lf("Start recording")} className={`ui left floated icon button ${active ? "green" : "red circular"} toggleRecord`} onClick={toggle}>
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
        // Initialize chart
        const serialTheme = pxt.appTarget.serial && pxt.appTarget.serial.editorTheme;
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
            const valueText = pxsim.Math_.roundWithPrecision(value, 2).toString();
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

export class ResourceImporter implements pxt.editor.IResourceImporter {
    public id: "console";
    public canImport(data: File): boolean {
        return data.type == "text/plain";
    }

    public importAsync(project: pxt.editor.IProjectView, data: File): Promise<void> {
        return ts.pxtc.Util.fileReadAsTextAsync(data)
            .then(txt => {
                if (!txt) {
                    core.errorNotification(lf("Ooops, could not read file"));
                    return;
                }

                // parse times
                const lines = txt.split(/\n/g).map(line => {
                    // extract timespace
                    const t = /^\s*(\d+)>/.exec(line);
                    if (t) line = line.substr(t[0].length);
                    return {
                        type: "serial",
                        data: line + "\n",
                        id: data.name,
                        receivedTime: t ? parseFloat(t[1]) : undefined
                    } as pxsim.SimulatorSerialMessage;
                })
                if (!lines.length)
                    return;

                // normalize timestamps
                const now = Util.now();
                const linest = lines.filter(line => !!line.receivedTime);
                if (linest.length) {
                    const tmax = linest[linest.length - 1].receivedTime || 0;
                    linest.forEach(line => line.receivedTime += now - tmax);
                }

                // show console

                // send as serial message
                lines.forEach(line => window.postMessage(line, "*"));
            });
    }
}
