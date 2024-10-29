import * as React from "react"
import * as Smoothie from "smoothie"
import * as pkg from "./package"
import * as core from "./core"
import * as srceditor from "./srceditor"
import * as sui from "./sui"
import * as data from "./data";
import { EditorToggle } from "../../react-common/components/controls/EditorToggle";

import Util = pxt.Util
import { fireClickOnEnter } from "./util"
import { classList } from "../../react-common/components/util"

import IProjectView = pxt.editor.IProjectView;
import IResourceImporter = pxt.editor.IResourceImporter;

const maxEntriesPerChart: number = 4000;

export class Editor extends srceditor.Editor {
    savedMessageQueue: pxsim.SimulatorSerialMessage[] = []
    maxSavedMessages: number = 1000;
    charts: Chart[] = []
    chartIdx: number = 0
    sourceMap: pxt.Map<string> = {}
    serialInputDataBuffer: string = ""
    maxSerialInputDataLength: number = 255;
    isSim: boolean = true;
    isCsvView: boolean = undefined;
    maxConsoleEntries: number = 500;
    active: boolean = true
    rawDataBuffer: string = ""
    maxBufferLength: number = 100000;
    csvHeaders: string[] = [];

    lineColors: string[];
    hcLineColors: string[];
    currentLineColors: string[];
    highContrast?: boolean = false;

    // CSV
    csvLineCount: 0;
    rawCsvBuf = "";
    receivedCsv: boolean;
    receivedLog: boolean;
    nextEntryIsOdd: boolean = true;

    //refs
    startPauseButton: StartPauseButton;
    consoleRoot: HTMLDivElement;
    chartRoot: HTMLDivElement;
    csvRoot: HTMLDivElement;
    serialRoot: HTMLDivElement;

    getId() {
        return "serialEditor"
    }

    hasHistory() { return false; }

    hasEditorToolbar() {
        return false
    }

    setVisible(b: boolean) {
        // TODO: It'd be great to re-render this component dynamically when the contrast changes,
        // but for now the user has to toggle the serial editor to see a change.
        const highContrast = core.getHighContrastOnce();
        if (highContrast !== this.highContrast) {
            this.setHighContrast(highContrast)
        }
        this.isVisible = b;

        if (this.isSim && this.receivedCsv && (this.isCsvView === undefined || !this.receivedLog)) {
            // If only csv received, default to csv.
            this.setCsv(!this.receivedLog);
            this.parent.forceUpdate();
        } else if (this.isCsvView && (!this.receivedCsv || !this.isSim)) {
            this.setCsv(false);
            this.parent.forceUpdate();
        }

        if (this.isCsvView) {
            pxt.BrowserUtils.addClass(this.serialRoot, "csv-view");
        } else {
            pxt.BrowserUtils.removeClass(this.serialRoot, "csv-view");
        }
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

    setCsv(b: boolean) {
        if (this.isCsvView != b) {
            this.isCsvView = !!b;
            if (this.serialRoot) {
                if (this.isCsvView) {
                    pxt.BrowserUtils.addClass(this.serialRoot, "csv-view");
                } else {
                    pxt.BrowserUtils.removeClass(this.serialRoot, "csv-view");
                }
            }
        }
    }

    simStateChanged() {
        this.charts.forEach((chart) => chart.setRealtimeData(this.wantRealtimeData()));
    }

    wantRealtimeData() {
        // Simulator only: Use the chart's `nonRealtimeData` flag to pause scrolling when the simulator isn't running.
        return (!this.isSim || this.parent.isSimulatorRunning());
    }

    constructor(public parent: IProjectView) {
        super(parent)
        window.addEventListener("message", this.processEvent.bind(this), false)
        const serialTheme = pxt.appTarget.serial && pxt.appTarget.serial.editorTheme;
        this.lineColors = (serialTheme && serialTheme.lineColors) || ["#e00", "#00e", "#0e0"];
        this.hcLineColors = ["#000"];
        this.currentLineColors = this.lineColors;

        this.goBack = this.goBack.bind(this);
        this.toggleRecording = this.toggleRecording.bind(this);
        this.downloadRaw = this.downloadRaw.bind(this);
        this.downloadRawText = this.downloadRawText.bind(this);
        this.downloadConsoleCSV = this.downloadConsoleCSV.bind(this);
        this.setCsv = this.setCsv.bind(this);
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
        const isClearLog = smsg.csvType === "clear";
        if (isClearLog && this.isCsvView) {
            this.clear();
            return;
        }

        smsg.receivedTime = smsg.receivedTime || Util.now();
        if (!!smsg.csvType) {
            this.receivedCsv = true;
        } else {
            this.receivedLog = true;
        }
        if (this.isVisible) {
            if (this.isCsvView && !this.receivedCsv) {
                // have not received a csv yet but in csv view; swap back to pxt.
                this.setCsv(false);
            } else if (!this.isCsvView && !this.receivedLog) {
                this.setCsv(true);
            }
        }
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
        const isCsv = !!smsg.csvType
        if (sim != this.isSim) return;

        // clean up input
        const data = smsg.data || ""
        const source = smsg.id || "?"
        const receivedTime = smsg.receivedTime || Util.now()

        const niceSource = this.mapSource(source);

        if (this.shouldShowToggle()) {
            pxt.BrowserUtils.removeClass(this.serialRoot, "no-toggle")
        }
        if (isCsv) {
            this.appendRawCsvData(data);
            if (smsg.csvType === "headers") {
                this.processCsvHeaders(data, receivedTime);
            } else if (smsg.csvType === "row") {
                this.processCsvRows(data, receivedTime);
            }
        } else {
            this.appendRawData(data);
            // chunk into lines
            const lines = this.chunkDataIntoLines(data)

            // process each line
            for (const line of lines) {
                this.processMessageLine(line, niceSource, receivedTime);
            }
        }
    }

    createTable() {
        const table = document.createElement("table");
        table.appendChild(document.createElement("thead"));
        table.appendChild(document.createElement("tbody"));
        this.csvRoot.appendChild(table);
        this.nextEntryIsOdd = true;
        return table;
    }

    processCsvHeaders(line: string, receivedTime: number) {
        const csvTable = this.createTable();
        const tr = document.createElement("tr");
        tr.title = lf("Received: {0}", new Date(receivedTime).toTimeString());
        for (const header of line.trim().split(",")) {
            const headerElement = document.createElement("th");
            headerElement.appendChild(document.createTextNode(header));
            tr.appendChild(headerElement);
        }
        this.addCsvRow(tr, csvTable.firstChild as HTMLTableSectionElement);
    }

    processCsvRows(line: string, receivedTime: number) {
        let csvTable = this.csvRoot.lastChild || this.createTable();

        const tr = document.createElement("tr");
        tr.title = lf("Received: {0}", new Date(receivedTime).toTimeString());
        if (this.nextEntryIsOdd) {
            tr.classList.add("odd");
        }
        this.nextEntryIsOdd = !this.nextEntryIsOdd;
        for (const data of line.trim().split(",")) {
            const dataElement = document.createElement("td");
            dataElement.appendChild(document.createTextNode(data));
            tr.appendChild(dataElement);
        }
        this.addCsvRow(tr, csvTable.lastChild as HTMLTableSectionElement);
    }

    goToLatest = () => {
        const latestTable = this.csvRoot?.lastChild;
        if (!latestTable) return;
        //             last body row                   || last header row
        const lastEl = latestTable.lastChild.lastChild || latestTable.firstChild.lastChild;
        (lastEl as HTMLTableRowElement).scrollIntoView?.();
        pxt.BrowserUtils.addClass(this.serialRoot, "hide-view-latest");
    }

    addCsvRow(row: HTMLTableRowElement, target: HTMLTableSectionElement) {
        const currentlyAtBottom = target.getBoundingClientRect().bottom <= window.innerHeight;
        target.appendChild(row);
        this.checkCsvLineCount();
        if (currentlyAtBottom)
            row.scrollIntoView();
        else
            pxt.BrowserUtils.removeClass(this.serialRoot, "hide-view-latest");
    }

    checkCsvLineCount() {
        this.csvLineCount++;
        while (this.csvLineCount > this.maxConsoleEntries) {
            const firstTable = this.csvRoot.firstChild;
            const thead = firstTable.firstChild;
            const tbody = firstTable.lastChild;
            if (tbody.hasChildNodes()) {
                // remove first data row in table
                tbody.firstChild.remove();
                this.csvLineCount--;
            } else if (tbody.hasChildNodes()) {
                // if no other data in body, clear header
                thead.firstChild.remove();
                this.csvLineCount--;
            }

            if (!tbody.hasChildNodes() && !thead.hasChildNodes()) {
                // table is now empty, clear it.
                firstTable.remove();
            }
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
    appendRawCsvData(data: string) {
        this.rawCsvBuf += data;
        if (this.rawCsvBuf.length > this.maxBufferLength) {
            this.rawCsvBuf.slice(this.rawCsvBuf.length / 4);
        }
    }

    appendGraphEntry(source: string, variable: string, nvalue: number, receivedTime: number) {
        //See if there is a "home chart" that this point belongs to -
        //if not, create a new chart
        let homeChart = this.charts.find((chart) => chart.shouldContain(source, variable));
        if (!homeChart) {
            homeChart = new Chart(source, variable, this.chartIdx, this.currentLineColors)
            homeChart.setRealtimeData(this.wantRealtimeData());
            this.chartIdx++;
            this.charts.push(homeChart)
            this.chartRoot.appendChild(homeChart.getElement());
            pxt.BrowserUtils.removeClass(this.chartRoot, "nochart");
            if (this.consoleRoot) {
                pxt.BrowserUtils.removeClass(this.consoleRoot, "nochart");
            }

            // Force rerender to hide placeholder chart
            if (this.charts.length == 1) this.parent.forceUpdate();
        }
        homeChart.addPoint(variable, nvalue, receivedTime)
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
            let newEntry = document.createElement("div")
            //Make a new non-collapsed entry
            newEntry.appendChild(document.createTextNode(line))
            this.consoleRoot.appendChild(newEntry)
        }
        this.consoleRoot.scrollTop = this.consoleRoot.scrollHeight
        while (this.consoleRoot.childElementCount > this.maxConsoleEntries) {
            this.consoleRoot.removeChild(this.consoleRoot.firstChild)
        }
        if (this.consoleRoot && this.consoleRoot.childElementCount > 0) {
            if (this.chartRoot) {
                pxt.BrowserUtils.removeClass(this.chartRoot, "noconsole");
            }
            if (this.consoleRoot) {
                pxt.BrowserUtils.removeClass(this.consoleRoot, "noconsole");
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
            pxt.BrowserUtils.addClass(this.chartRoot, "noconsole");
            pxt.BrowserUtils.addClass(this.chartRoot, "nochart");
        }
        if (this.consoleRoot) {
            this.clearNode(this.consoleRoot);
            pxt.BrowserUtils.addClass(this.consoleRoot, "noconsole");
            pxt.BrowserUtils.addClass(this.consoleRoot, "nochart");
        }

        if (!this.isSim) {
            this.setCsv(false);
        }

        this.charts = []
        this.serialInputDataBuffer = ""
        this.rawDataBuffer = ""
        this.rawCsvBuf = ""
        this.savedMessageQueue = []
        this.sourceMap = {}
        this.csvHeaders = [];

        this.savedMessageQueue = []

        if (this.csvRoot) {
            this.clearNode(this.csvRoot);
        }
        this.csvLineCount = 0;
        pxt.BrowserUtils.addClass(this.serialRoot, "hide-view-latest");

        // If the editor is currently visible, leave these as is to leave toggle state.
        if (!this.isVisible) {
            this.receivedCsv = false;
            this.receivedLog = false;
            if (this.serialRoot) {
                pxt.BrowserUtils.addClass(this.serialRoot, "no-toggle")
            }
        }
    }

    dataIsCsv(nl: number, datas: number[][][]): boolean {
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

    downloadConsoleCSV() {
        if (this.isCsvView) {
            this.downloadRaw(this.rawCsvBuf, "csv", "text/csv");
            return;
        }
        // if not in csv mode, download inferred csv content.
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
            let isCSV = this.dataIsCsv(nl, datas);
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
        const time = currentIsoDateString();
        pxt.commands.browserDownloadAsync(Util.toUTF8(csvText), pxt.appTarget.id + '-' + lf("{id:csvfilename}data") + '-' + time + ".csv", "text/csv")
    }

    downloadRaw(buf: string, fileExtension = "txt", mimeType = "text/plain") {
        core.infoNotification(lf("Exporting text...."));
        const time = currentIsoDateString();
        // ensure \r\n newlines for windows <10
        if (pxt.BrowserUtils.isWindows())
            buf = buf.replace(/([^\r])\n/g, '$1\r\n');
        pxt.commands.browserDownloadAsync(
            Util.toUTF8(buf),
            pxt.appTarget.id + '-' + lf("{id:csvfilename}console") + '-' + time + `.${fileExtension}`,
            mimeType
        )
    }

    downloadRawText() {
        this.downloadRaw(this.rawDataBuffer);
    }

    goBack() {
        pxt.tickEvent("serial.backButton", undefined, { interactiveConsent: true })
        this.parent.openPreviousEditor()
    }

    handleStartPauseRef = (c: StartPauseButton) => {
        this.startPauseButton = c;
    }

    handleChartRootRef = (c: HTMLDivElement) => {
        this.chartRoot = c;
    }

    handleConsoleRootRef = (c: HTMLDivElement) => {
        this.consoleRoot = c;
    }

    handleCsvRootRef = (c: HTMLDivElement) => {
        this.csvRoot = c;
    }

    handleSerialRootRef = (c: HTMLDivElement) => {
        this.serialRoot = c;
    }

    toggleOptions = () => {
        return [{
            label: lf("Console"),
            title: lf("Console"),
            focusable: true,
            icon: "fas fa-terminal",
            onClick: () => {
                this.setCsv(false);
                this.parent.forceUpdate();
            },
            view: "console"
        }, {
            label: lf("Data Log"),
            title: lf("Data Log"),
            focusable: true,
            icon: "fas fa-table",
            onClick: () => {
                this.setCsv(true);
                this.parent.forceUpdate();
            },
            view: "datalog"
        }];
    }

    getToggle = () => {
        const toggleOptions = this.toggleOptions();
        return <EditorToggle
            id="serial-editor-toggle"
            className="slim tablet-compact"
            items={toggleOptions}
            selected={toggleOptions.findIndex(i => i.view === (this.isCsvView ? "datalog" : "console"))}
        />
    }

    shouldShowToggle = () => {
        return this.receivedCsv && this.receivedLog && this.isSim;
    }

    display() {
        const rootClasses = classList(
            !this.shouldShowToggle() && "no-toggle",
            this.isCsvView && "csv-view",
            "hide-view-latest"
        );

        return (
            <div id="serialArea" className={rootClasses} ref={this.handleSerialRootRef}>
                <div id="serialHeader" className="ui serialHeader">
                    <div className="leftHeaderWrapper">
                        <div className="leftHeader">
                            <sui.Button title={lf("Go back")} tabIndex={0} onClick={this.goBack} onKeyDown={fireClickOnEnter}>
                                <sui.Icon icon="arrow left" />
                                <span className="ui text landscape only">{lf("Go back")}</span>
                            </sui.Button>
                            {this.getToggle()}
                        </div>
                    </div>
                    <div className="rightHeader">
                        <sui.Button title={lf("Save raw text")} className="ui icon button editorExport csv-hide" ariaLabel={lf("Save raw text")} onClick={this.downloadRawText}>
                            <sui.Icon icon="copy" />
                        </sui.Button>
                        <sui.Button title={lf("Export data")} className="ui icon blue button editorExport" ariaLabel={lf("Export data")} onClick={this.downloadConsoleCSV}>
                            <sui.Icon icon="download" />
                        </sui.Button>
                        <StartPauseButton ref={this.handleStartPauseRef} active={this.active} toggle={this.toggleRecording} />
                        <span className="ui small header">{this.isSim ? lf("Simulator") : lf("Device")}</span>
                    </div>
                </div>
                {this.charts?.length == 0 && <div id="serialPlaceholder" className="ui segment">
                    <div className="ui bottom left attached no-select label seriallabel">{lf("Values will be logged when the {0} sends data", this.isSim ? lf("simulator") : lf("device"))}</div>
                </div>}
                <div id="serialCharts" ref={this.handleChartRootRef}></div>
                <div id="serialConsole" ref={this.handleConsoleRootRef}></div>
                <div id="serialCsv" ref={this.handleCsvRootRef}></div>
                <sui.Button id="serialCsvViewLatest" onClick={this.goToLatest}>{lf("View latest row...")}</sui.Button>
            </div>
        )
    }

    domUpdate() {
    }
}

function currentIsoDateString() {
    return new Date().toISOString().replace(/[^\d\w]/gi,'-');
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

        return <sui.Button title={active ? lf("Pause recording") : lf("Start recording")} className={`ui left floated icon button ${active ? "green" : "red circular"} toggleRecord csv-hide`} onClick={toggle}>
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
    lines: pxt.Map<Smoothie.TimeSeries> = {};
    datas: pxt.Map<number[][]> = {};
    source: string;
    variable: string;
    chart: Smoothie.SmoothieChart;

    constructor(source: string, variable: string, chartIdx: number, lineColors: string[]) {
        // Initialize chart
        const serialTheme = pxt.appTarget.serial && pxt.appTarget.serial.editorTheme;
        const chartConfig: Smoothie.IChartOptions = {
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
        this.chart = new Smoothie.SmoothieChart(chartConfig);
        this.rootElement.className = "ui segment";
        this.source = source;
        this.variable = variable.replace(/\..*$/, ''); // keep prefix only

        this.rootElement.appendChild(this.makeLabel())
        this.rootElement.appendChild(this.makeCanvas())
    }

    tooltip(timestamp: number, data: { series: Smoothie.TimeSeries, index: number, value: number }[]): string {
        return data.map(n => {
            const name = (n.series as any).timeSeries.__name;
            return `<span>${name ? name + ': ' : ''}${n.value}</span>`;
        }).join('<br/>');
    }

    getLine(name: string): Smoothie.TimeSeries {
        let line = this.lines[name];
        if (!line) {
            const lineColor = this.lineColors[this.chartIdx++ % this.lineColors.length]
            this.lines[name] = line = new Smoothie.TimeSeries();
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

    setRealtimeData(realtime: boolean) {
        this.chart.options.nonRealtimeData = !realtime;
    }
}

export class ResourceImporter implements IResourceImporter {
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
