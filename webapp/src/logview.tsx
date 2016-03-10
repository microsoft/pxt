import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"
import * as core from "./core";
import * as trendchart from "./trendchart";

export interface ILogProps {
    maxEntries?: number;
    maxAccValues?: number;
}
export interface ILogEntry {
    id: number;
    theme: string;
    variable?: string;
    accvalues?: {t: number; v:number}[];
    time:number;
    value: string;
    source: string;
    count: number;
}
export interface ILogState {
    entries: ILogEntry[];
}

export class LogView extends React.Component<ILogProps, ILogState> {
    static counter = 0;
    private shouldScroll = false;

    constructor(props: ILogProps) {
        super(props)
        this.state = {
            entries: []
        }

        this.registerEvents();
        this.registerChromeSerial();
    }

    registerChromeSerial() {
        let buffers: ks.Util.StringMap<string> = {};
        let chrome = (window as any).chrome;
        if (chrome && chrome.runtime) {
            let port = chrome.runtime.connect("hccbjdgogdkdomojppdljbijomobfdap", { name: "micro:bit" });
            port.onMessage.addListener((msg: { type: string; id: string; data: string; }) => {
                if (msg.type == "serial") {

                    let buf = (buffers[msg.id] || "") + msg.data;
                    let i = buf.lastIndexOf("\n");
                    if (i >= 0) {
                        let msgb = buf.substring(0, i + 1);

                        this.appendEntry('mbit' + msg.id, msgb, 'black');

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
                case 'run': this.setState({ entries: [] }); break;
                case 'serial':
                    let value = msg.data || '';
                    let source = msg.id || '?';
                    let theme = source.split('-')[0] || '';
                    this.appendEntry(source, value, theme);
                    break;
            }
        }, false);
    }

    appendEntry(source: string, value: string, theme: string) {
        this.setState(prev => {
            let ens = prev.entries;
            if (ens.length > this.props.maxEntries)
                ens = ens.slice(-this.props.maxEntries);
            // find the entry with same source
            let last: ILogEntry = undefined;
            let m = /([^:]+):\s*(-?\d+)/i.exec(value);
            let variable = m ? m[1] : undefined;
            let nvalue = m ? parseInt(m[2]) : null;
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
                        v:nvalue
                    });
                    if (last.accvalues.length > this.props.maxAccValues)
                        last.accvalues.shift();
                }
                last.count++;
            }
            else {
                ens.push({
                    id: LogView.counter++,
                    theme: theme,
                    time: Date.now(),
                    value: value,
                    source: source,
                    count: 1,
                    variable: variable,
                    accvalues: nvalue != null ? [{t:0, v:nvalue}] : undefined
                });
            }
            return { entries: ens };
        })
    }

    static defaultProps: ILogProps = {
        maxEntries: 100,
        maxAccValues: 1000
    }

    componentWillUpdate() {
        let node = ReactDOM.findDOMNode(this) as HTMLElement;
        this.shouldScroll = node.scrollTop + node.offsetHeight === node.scrollHeight;
    }

    componentDidUpdate() {
        if (this.shouldScroll) {
            let node = ReactDOM.findDOMNode(this);
            node.scrollTop = node.scrollHeight
        }
    }

    clear() {
        this.setState({ entries: [] })
    }

    render() {
        let msgs = this.state.entries.map(entry =>
            <div className={"ui log " + entry.theme + (entry.accvalues ? " link" : "")} key={entry.id} onClick={entry.accvalues ? () => this.tableToCSV(entry) : undefined}>
                {entry.accvalues ? <span className={"ui log " + entry.theme + " gauge"}>{entry.value}</span>
                : entry.count > 1 ? <span className="ui log counter">{entry.count}</span> : ""}
                {entry.accvalues ? <trendchart.TrendChart className={"ui trend " + entry.theme} log={entry} width={80} height={15} /> : entry.value}
            </div>);

        return <div className='ui segment hideempty logs'>
            {msgs}
        </div>;
    }

    tableToCSV(entry: ILogEntry) {
        let csv = "t, " + entry.variable + "\n" 
            + entry.accvalues.map(v => v.t + ", " + v.v).join('\n');
        core.browserDownloadText(csv, 'data.csv', 'text/csv')
    }
}