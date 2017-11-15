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

export class Editor extends srceditor.Editor {
    charts: Chart[] = []
    chartIdx: number = 0
    sourceMap: pxt.Map<string> = {}
    consoleBuffer: string = ""
    isSim: boolean = true
    maxConsoleLineLength: number = 255
    maxConsoleEntries: number = 100
    active: boolean = true
    maxChartTime: number = 18000
    chartDropper: number

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
        this.isVisible = b;
        if (this.isVisible) {
            this.startRecording()
        }
        else {
            this.pauseRecording()
        }
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
        window.addEventListener("message", this.processMessage.bind(this), false)
    }

    processMessage(ev: MessageEvent) {
        let msg = ev.data
        if (!this.active || msg.type !== "serial") return;

        const smsg = msg as pxsim.SimulatorSerialMessage
        const sim = !!smsg.sim
        if (sim != this.isSim) return;

        const data = smsg.data || ""
        const source = smsg.id || "?"

        if (!this.sourceMap[source]) {
            let sourceIdx = Object.keys(this.sourceMap).length + 1
            this.sourceMap[source] = lf("source") + sourceIdx.toString()
        }
        let niceSource = this.sourceMap[source]

        const m = /^\s*(([^:]+):)?\s*(-?\d+(\.\d*)?)/i.exec(data);
        if (m) {
            const variable = m[2] || '';
            const nvalue = parseFloat(m[3]);
            if (!isNaN(nvalue)) {
                this.appendGraphEntry(niceSource, variable, nvalue)
                return;
            }
        }

        this.appendConsoleEntry(data)
    }

    appendGraphEntry(source: string, variable: string, nvalue: number) {
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
            homeChart = new Chart(source, variable, this.chartIdx)
            this.chartIdx++;
            this.charts.push(homeChart)
            this.chartRoot.appendChild(homeChart.getElement());
        }
        homeChart.addPoint(variable, nvalue)
    }

    appendConsoleEntry(data: string) {
        for (let i = 0; i < data.length; ++i) {
            let ch = data[i]
            this.consoleBuffer += ch
            if (ch !== "\n" && this.consoleBuffer.length < this.maxConsoleLineLength) {
                continue
            }
            if (ch === "\n") {
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
            } else {
                //Buffer is full
                //Make a new entry with <span>, not <div>
                let newEntry = document.createElement("span")
                newEntry.appendChild(document.createTextNode(this.consoleBuffer))
                this.consoleRoot.appendChild(newEntry)
            }
            this.consoleBuffer = ""
            this.consoleRoot.scrollTop = this.consoleRoot.scrollHeight
            if (this.consoleRoot.childElementCount > this.maxConsoleEntries) {
                this.consoleRoot.removeChild(this.consoleRoot.firstChild)
            }
            if (this.consoleRoot && this.consoleRoot.childElementCount > 0) {
                if (this.chartRoot) this.chartRoot.classList.remove("noconsole");
                if (this.consoleRoot) this.consoleRoot.classList.remove("noconsole");
            }
        }
    }

    dropStaleCharts() {
        let now = Util.now()
        this.charts.forEach((chart) => {
            if (now - chart.lastUpdatedTime > this.maxChartTime) {
                this.chartRoot.removeChild(chart.rootElement)
                chart.isStale = true
            }
        })
        this.charts = this.charts.filter(c => !c.isStale)
    }

    pauseRecording() {
        this.active = false
        if (this.startPauseButton) this.startPauseButton.setState({ active: this.active });
        this.charts.forEach(s => s.stop())
        clearInterval(this.chartDropper)
    }

    startRecording() {
        this.active = true
        if (this.startPauseButton) this.startPauseButton.setState({ active: this.active });
        this.charts.forEach(s => s.start())
        this.chartDropper = setInterval(this.dropStaleCharts.bind(this), 20000)
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
    }

    downloadCSV() {
        const lines: { name: string; line: TimeSeries; }[] = [];
        this.charts.forEach(chart => Object.keys(chart.lines).forEach(k => lines.push({ name: `${k} (${chart.source})`, line: chart.lines[k] })));
        let csv = lines.map(line => `time (s), ${line.name}`).join(', ') + '\r\n';

        const datas = lines.map(line => line.line.data);
        const nl = datas.map(data => data.length).reduce((l, c) => Math.max(l, c));
        const nc = this.charts.length;
        for (let i = 0; i < nl; ++i) {
            csv += datas.map(data => i < data.length ? `${(data[i][0] - data[0][0]) / 1000}, ${data[i][1]}` : ' , ').join(', ');
            csv += '\r\n';
        }

        pxt.commands.browserDownloadAsync(csv, "data.csv", "text/csv")
        core.infoNotification(lf("Exporting data...."));
    }

    goBack() {
        pxt.tickEvent("serial.backButton")
        this.parent.openPreviousEditor()
    }

    display() {
        return (
            <div id="serialArea">
                <div id="serialHeader" className="ui">
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
                <div id="serialCharts" className="noconsole" ref={e => this.chartRoot = e}></div>
                <div id="serialConsole" className="noconsole" ref={e => this.consoleRoot = e}></div>
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
    source: string;
    variable: string;
    chart: SmoothieChart;
    isStale: boolean = false;
    lastUpdatedTime: number = 0;

    constructor(source: string, variable: string, chartIdx: number) {
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
        this.lineColors = serialTheme && serialTheme.lineColors || ["#f00", "#00f", "#0f0", "#ff0"]
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
                fillStyle: this.hexToHalfOpacityRgba(lineColor),
                lineWidth: 1
            })
        }
        return line;
    }

    hexToHalfOpacityRgba(hex: string) {
        let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
        hex = hex.replace(shorthandRegex, function (m, r, g, b) {
            return r + r + g + g + b + b;
        })
        let m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        if (!m) {
            return hex
        }
        let nums = m.slice(1, 4).map(n => parseInt(n, 16))
        nums.push(0.3)
        return "rgba(" + nums.join(",") + ")"
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

    addPoint(name: string, value: number) {
        const line = this.getLine(name);
        line.append(Util.now(), value)
        this.lastUpdatedTime = Util.now();
        if (Object.keys(this.lines).length == 1) {
            // update label with last value
            const valueText = Number(Math.round(Number(value + "e+2")) + "e-2").toString();
            this.label.innerText = this.variable ? `${this.variable}: ${valueText}` : valueText;
        } else {
            this.label.innerText = this.variable || '';
        }
    }

    start() {
        this.chart.start()
    }

    stop() {
        this.chart.stop()
    }
}