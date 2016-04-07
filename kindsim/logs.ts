namespace ks.rt.logs {
    export interface ILogProps {
        maxEntries?: number;
        maxAccValues?: number;
        onCSVData?: (name: string, d: string) => void;
    }

    interface ILogEntry {
        id: number;
        theme: string;
        variable?: string;
        accvalues?: { t: number; v: number }[];
        time: number;
        value: string;
        source: string;
        count: number;

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

        constructor(public log: ILogEntry, className: string) {
            this.log = log;
            this.element = Svg.elt("svg") as SVGSVGElement;
            Svg.hydrate(this.element, { class: className, viewBox: `0 0 ${this.vpw} ${this.vph}` })
            this.g = Svg.child(this.element, "g") as SVGGElement;
            this.line = Svg.child(this.g, "polyline") as SVGPolylineElement;
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
            Svg.hydrate(this.line, { points: points });
        }
    }

    export class LogViewElement {
        static counter = 0;
        private shouldScroll = false;
        private entries: ILogEntry[] = [];
        private serialBuffers: ks.rt.Map<string> = {};
        public element: HTMLDivElement;

        constructor(public props: ILogProps) {
            this.registerEvents();
            this.registerChromeSerial();
            this.element = document.createElement("div");
            this.element.className = "ui segment hideempty logs";
        }

        registerChromeSerial() {
            let buffers: ks.rt.Map<string> = {};
            let chrome = (window as any).chrome;
            if (chrome && chrome.runtime) {
                let port = chrome.runtime.connect("cihhkhnngbjlhahcfmhekmbnnjcjdbge", { name: "micro:bit" });
                port.onMessage.addListener((msg: { type: string; id: string; data: string; }) => {
                    if (msg.type == "serial") {

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
                        let value = (msg.data as string) || '';
                        let source = msg.id || '?';
                        let theme = source.split('-')[0] || '';
                        if (!/^[a-z]+$/.test(theme)) theme = 'black';
                        let buffer = this.serialBuffers[source] || '';
                        for(let i = 0; i < value.length; ++i) {
                            switch(value.charCodeAt(i)) {
                                case 10: //'\n'
                                    this.appendEntry(source, buffer, theme);
                                    buffer = '';
                                    break;
                                case 13: //'\r'
                                    break;
                                default:
                                    buffer += value[i];
                                    break;
                            }
                        }
                        this.serialBuffers[source] = buffer;
                        break;
                }
            }, false);
        }

        appendEntry(source: string, value: string, theme: string) {
            let ens = this.entries;
            while (ens.length > this.props.maxEntries) {
                let po = ens.shift();
                if (po.element) po.element.remove();
            }
            // find the entry with same source
            let last: ILogEntry = undefined;
            let m = /(([^:]+):)?\s*(-?\d+)/i.exec(value);
            let variable = m ? (m[2] || ' ') : undefined;
            let nvalue = m ? parseInt(m[3]) : null;
            for (let i = ens.length - 1; i >= 0; --i) {
                if (ens[i].source == source &&
                    (ens[i].value == value ||
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
                let e: ILogEntry = {
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
                if (e.accvalues) {
                    e.accvaluesElement = document.createElement('span');
                    e.accvaluesElement.className = "ui log " + e.theme + " gauge"
                    e.chartElement = new TrendChartElement(e, "ui trend " + e.theme)
                    if (this.props.onCSVData) {
                        e.element.onclick = () => this.tableToCSV(e);
                        e.element.className += " link";
                    }
                    e.element.appendChild(e.accvaluesElement);
                    e.element.appendChild(e.chartElement.element);
                }
                e.element.appendChild(e.valueElement);
                ens.push(e);
                this.element.appendChild(e.element);
                this.scheduleRender(e);
            }
        }

        renderFiberId: number;
        private scheduleRender(e: ILogEntry) {
            e.dirty = true;
            if (!this.renderFiberId) this.renderFiberId = setTimeout(() => this.render(), 50);
        }

        clear() {
            this.entries = [];
            this.element.innerHTML = '';
            this.serialBuffers = {};
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

        private tableToCSV(entry: ILogEntry) {
            let t0 = entry.accvalues.length > 0 ? entry.accvalues[0].t : 0;
            let name = entry.variable.trim() || "data";
            let csv = `${"time"}, ${name}\n`
                + entry.accvalues.map(v => ((v.t - t0) / 1000) + ", " + v.v).join('\n');
            let fn = `${(entry.variable.replace(/[^a-z0-9-_]/i, '') || "data")}.csv`;            
            this.props.onCSVData(fn, csv);
        }
    }
}