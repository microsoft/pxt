namespace pxsim.logs {
    export interface ILogProps {
        maxEntries?: number;
        maxLineLength?: number;
        maxAccValues?: number;
        onClick?: (entries: ILogEntry[]) => void;
        onTrendChartChanged?: () => void;
        onTrendChartClick?: (entry: ILogEntry) => void;

        // information for optional extensions
        chromeExtension?: string;
        useHF2?: boolean;
        vendorId?: string; // used by node-serial
        productId?: string; // used by node-serial
        nameFilter?: string; // regex to match devices
    }

    export interface ILogEntry {
        id: number;
        theme: string;
        variable?: string;
        accvalues?: { t: number; v: number }[];
        time: number;
        value: string;
        source: string;
        count: number;
    }

    interface ILogEntryElement extends ILogEntry {
        dirty: boolean;
        element?: HTMLDivElement;
        accvaluesElement?: HTMLSpanElement;
        countElement?: HTMLSpanElement;
        chartElement?: TrendChartElement;
        valueElement?: Text;
    }

    class TrendChartElement {
        public element: SVGSVGElement;
        g: SVGGElement;
        line: SVGPolylineElement;
        vpw = 80;
        vph = 15;

        constructor(public log: ILogEntryElement, className: string) {
            this.log = log;
            this.element = svg.elt("svg") as SVGSVGElement;
            svg.hydrate(this.element, { class: className, viewBox: `0 0 ${this.vpw} ${this.vph}` })
            this.g = svg.child(this.element, "g") as SVGGElement;
            this.line = svg.child(this.g, "polyline") as SVGPolylineElement;
        }

        render() {
            const data = this.log.accvalues.slice(-25); // take last 10 entry
            const margin = 2;
            const times = data.map(d => d.t)
            const values = data.map(d => d.v);
            const maxt = Math.max.apply(null, times);
            const mint = Math.min.apply(null, times);
            const maxv = Math.max.apply(null, values)
            const minv = Math.min.apply(null, values)
            const h = (maxv - minv) || 10;
            const w = (maxt - mint) || 10;

            const points = data.map(d => `${(d.t - mint) / w * this.vpw},${this.vph - (d.v - minv) / h * (this.vph - 2 * margin) - margin}`).join(' ');
            svg.hydrate(this.line, { points: points });
        }
    }

    export class LogViewElement {
        static counter = 0;
        private shouldScroll = false;
        private entries: ILogEntryElement[] = [];
        private serialBuffers: pxsim.Map<string> = {};
        private dropSim = false; // drop simulator events
        public element: HTMLDivElement;
        private labelElement: HTMLElement;

        constructor(public props: ILogProps) {
            this.registerEvents();
            this.registerChromeSerial();
            this.element = document.createElement("div");
            this.element.className = "ui segment hideempty logs";
            if (this.props.onClick)
                this.element.onclick = () => this.props.onClick(this.rows());
        }

        public setLabel(text: string, theme?: string) {
            if (this.labelElement && this.labelElement.innerText == text) return;

            if (this.labelElement) {
                if (this.labelElement.parentElement) this.labelElement.parentElement.removeChild(this.labelElement);
                this.labelElement = undefined;
            }
            if (text) {
                this.labelElement = document.createElement("a");
                this.labelElement.className = `ui ${theme} top right attached mini label`;
                this.labelElement.appendChild(document.createTextNode(text));
            }
        }

        public hasTrends(): boolean {
            return this.entries.some(entry => !!entry.chartElement);
        }

        // creates a deep clone of the log entries
        public rows(): ILogEntry[] {
            return this.entries.map(e => {
                return {
                    id: e.id,
                    theme: e.theme,
                    variable: e.variable,
                    accvalues: e.accvalues ? e.accvalues.slice(0) : undefined,
                    time: e.time,
                    value: e.value,
                    source: e.source,
                    count: e.count
                };
            });
        }

        public streamPayload(startTime: number): { fields: string[]; values: number[][]; } {
            // filter out data
            let es = this.entries.filter(e => !!e.accvalues && e.time + e.accvalues[e.accvalues.length - 1].t >= startTime);
            if (es.length == 0) return undefined;

            let fields: Map<number> = { "timestamp": 1, "partition": 1 };
            let rows: number[][] = [];

            function entryVariable(e: ILogEntry): string {
                return /^\s*$/.test(e.variable) ? 'data' : e.variable
            }

            // collect fields
            es.forEach(e => {
                let n = entryVariable(e);
                if (!fields[n]) fields[n] = 1;
            })

            // collapse data and fill values
            let fs = Object.keys(fields);
            es.forEach(e => {
                let n = entryVariable(e);
                let ei = fs.indexOf(n);
                e.accvalues
                    .filter(v => (e.time + v.t) >= startTime)
                    .forEach(v => {
                        let row = [e.time + v.t, 0];
                        for (let i = 2; i < fs.length; ++i)
                            row.push(i == ei ? v.v : null);
                        rows.push(row);
                    })
            })

            return { fields: fs, values: rows };
        }

        registerChromeSerial() {
            const extensionId = this.props.chromeExtension;
            if (!extensionId) return;

            let buffers: pxsim.Map<string> = {};
            let chrome = (window as any).chrome;
            if (chrome && chrome.runtime) {
                console.debug(`chrome: connecting to extension ${extensionId}`)
                const port = chrome.runtime.connect(extensionId, { name: "serial" });
                port.postMessage({
                    type: "serial-config",
                    useHF2: this.props.useHF2,
                    vendorId: this.props.vendorId,
                    productId: this.props.productId,
                    nameFilter: this.props.nameFilter
                })
                port.onMessage.addListener((msg: { type: string; id: string; data: string; }) => {
                    if (msg.type == "serial") {
                        if (!this.dropSim) {
                            this.clear();
                            this.dropSim = true;
                        }
                        let buf = (buffers[msg.id] || "") + msg.data;
                        let i = buf.lastIndexOf("\n");
                        if (i >= 0) {
                            let msgb = buf.substring(0, i + 1);
                            msgb.split('\n').filter(line => !!line).forEach(line => this.appendEntry('microbit' + msg.id, line, 'black'));
                            buf = buf.slice(i + 1);
                        }

                        buffers[msg.id] = buf;
                    }
                });
            }
        }

        registerEvents() {
            window.addEventListener('message', (ev: MessageEvent) => {
                let msg = ev.data;
                switch (msg.type || '') {
                    case 'serial':
                        const smsg = msg as pxsim.SimulatorSerialMessage;
                        /**
                        if (this.dropSim && smsg.sim) {
                            // drop simulated event since we are receiving real events
                            return;
                        } else if (!this.dropSim && !smsg.sim) {
                            // first non-simulator serial event, drop all previous events
                            this.clear();
                            this.dropSim = true;
                        }
                        **/
                        const value = smsg.data || '';
                        const source = smsg.id || '?';
                        let theme = source.split('-')[0] || '';
                        if (!/^[a-z]+$/.test(theme)) theme = 'black';
                        let buffer = this.serialBuffers[source] || '';
                        for (let i = 0; i < value.length; ++i) {
                            switch (value.charCodeAt(i)) {
                                case 10: //'\n'
                                    this.appendEntry(source, buffer, theme);
                                    buffer = '';
                                    break;
                                case 13: //'\r'
                                    break;
                                default:
                                    buffer += value[i];
                                    if (buffer.length > (this.props.maxLineLength || 255)) {
                                        this.appendEntry(source, buffer, theme);
                                        buffer = ''
                                    }
                                    break;
                            }
                        }
                        this.serialBuffers[source] = buffer;
                        break;
                }
            }, false);
        }

        appendEntry(source: string, value: string, theme: string) {
            if (this.labelElement && !this.labelElement.parentElement)
                this.element.insertBefore(this.labelElement, this.element.firstElementChild);

            let ens = this.entries;
            while (ens.length > this.props.maxEntries) {
                let po = ens.shift();
                if (po.element && po.element.parentElement) po.element.parentElement.removeChild(po.element);
            }
            // find the entry with same source
            let last: ILogEntryElement = undefined;
            let m = /^\s*(([^:]+):)?\s*(-?\d+)/i.exec(value);
            let variable = m ? (m[2] || ' ') : undefined;
            let nvalue = m ? parseInt(m[3]) : null;
            for (let i = ens.length - 1; i >= 0; --i) {
                if (ens[i].source == source &&
                    ((i == ens.length - 1 && ens[i].value == value) ||
                        (variable && ens[i].variable == variable))) {
                    last = ens[i];
                    break;
                }
            }

            if (last) {
                last.value = value;
                if (last.accvalues) {
                    last.accvalues.push({
                        t: Date.now() - last.time,
                        v: nvalue
                    });
                    if (last.accvalues.length > this.props.maxAccValues)
                        last.accvalues.shift();
                } else if (!last.countElement) {
                    last.countElement = document.createElement("span");
                    last.countElement.className = 'ui log counter';
                    last.element.insertBefore(last.countElement, last.element.firstChild);
                }
                last.count++;
                this.scheduleRender(last);
            }
            else {
                let e: ILogEntryElement = {
                    id: LogViewElement.counter++,
                    theme: theme,
                    time: Date.now(),
                    value: value,
                    source: source,
                    count: 1,
                    dirty: true,
                    variable: variable,
                    accvalues: nvalue != null ? [{ t: 0, v: nvalue }] : undefined,
                    element: document.createElement("div"),
                    valueElement: document.createTextNode('')
                };
                e.element.className = "ui log " + e.theme;
                let raiseTrends = false;
                if (e.accvalues) {
                    e.accvaluesElement = document.createElement('span');
                    e.accvaluesElement.className = "ui log " + e.theme + " gauge"
                    e.chartElement = new TrendChartElement(e, "ui trend " + e.theme)
                    if (this.props.onTrendChartClick) {
                        e.chartElement.element.onclick = () => this.props.onTrendChartClick(e);
                        e.chartElement.element.className += " link";
                    }
                    e.element.appendChild(e.accvaluesElement);
                    e.element.appendChild(e.chartElement.element);

                    raiseTrends = true;
                }
                e.element.appendChild(e.valueElement);
                ens.push(e);
                this.element.appendChild(e.element);
                this.scheduleRender(e);

                if (raiseTrends && this.props.onTrendChartChanged)
                    this.props.onTrendChartChanged();
            }
        }

        renderFiberId: number;
        private scheduleRender(e: ILogEntryElement) {
            e.dirty = true;
            if (!this.renderFiberId) this.renderFiberId = setTimeout(() => this.render(), 50);
        }

        clear() {
            this.entries = [];
            if (this.labelElement && this.labelElement.parentElement)
                this.labelElement.parentElement.removeChild(this.labelElement);
            this.element.innerHTML = '';
            this.serialBuffers = {};
            this.dropSim = false;
            if (this.props.onTrendChartChanged)
                this.props.onTrendChartChanged();
        }

        private render() {
            this.entries.forEach(entry => {
                if (!entry.dirty) return;

                if (entry.countElement) entry.countElement.innerText = entry.count.toString();
                if (entry.accvaluesElement) entry.accvaluesElement.innerText = entry.value;
                if (entry.chartElement) entry.chartElement.render();
                entry.valueElement.textContent = entry.accvalues ? '' : entry.value;
                entry.dirty = false;
            });
            this.renderFiberId = 0;
        }
    }

    export function entriesToCSV(entries: ILogEntry[]) {
        // first log all data entries to CSV
        let dataEntries: ILogEntry[] = [];
        let rows = entries.length;
        entries.forEach(e => {
            if (e.accvalues && e.accvalues.length > 0) {
                dataEntries.push(e);
                rows = Math.max(e.accvalues.length, rows);
            }
        });

        let csv = ''
        // name columns
        csv += dataEntries.map(entry => `${entry.theme} time, ${entry.theme} ${entry.variable.trim() || "data"}`)
            .concat(['log time', 'log source', 'log message'])
            .join(', ');
        csv += '\n';

        for (let i = 0; i < rows; ++i) {
            let cols: string[] = []

            dataEntries.forEach(entry => {
                let t0 = entry.accvalues[0].t;
                if (i < entry.accvalues.length) {
                    cols.push(((entry.accvalues[i].t - t0) / 1000).toString());
                    cols.push(entry.accvalues[i].v.toString());
                } else {
                    cols.push(' ');
                    cols.push(' ');
                }
            });

            if (i < entries.length) {
                let t0 = entries[0].time;
                cols.push(((entries[i].time - t0) / 1000).toString());
                cols.push(entries[i].source);
                cols.push(entries[i].value);
            }

            csv += cols.join(', ') + '\n';
        }

        return csv;
    }

    export function entryToCSV(entry: ILogEntry) {
        let t0 = entry.accvalues.length > 0 ? entry.accvalues[0].t : 0;
        let csv = `${entry.theme} time, ${entry.variable.trim() || "data"}\n`
            + entry.accvalues.map(v => ((v.t - t0) / 1000) + ", " + v.v).join('\n');
        return csv;
    }
}