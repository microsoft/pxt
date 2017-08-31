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
    static counter = 0
    private entries: ILogEntryElement[] = []
    private serialBuffers: pxsim.Map<string> = {}
    private isSim: boolean = true
    public element: HTMLDivElement
    private labelElement: HTMLElement
    private shouldScroll = false
    // TODO pass these values in with props or config?
    private maxEntries: number = 80
    private maxLineLength: number = 255
    private maxAccValues: number = 500
    private renderFiberId: number

    acceptsFile(file: pkg.File) {
        // TODO hardcoded string
        return file.name === "serial.json"
    }

    constructor(public parent: pxt.editor.IProjectView) {
        super(parent)
        this.setLabel(this.isSim ? lf("SIM") : lf("DEV"))
        window.addEventListener("message", this.processMessage.bind(this), false)
    }

    processMessage(ev:MessageEvent) {
        let msg = ev.data;
        switch (msg.type || '') {
            case 'serial':
                const smsg = msg as pxsim.SimulatorSerialMessage;
                const sim = !!smsg.sim || false;
                if (sim == this.isSim) {
                    const value = smsg.data || '';
                    const source = smsg.id || '?';
                    let theme = source.split('-')[0] || '';
                    if (!/^[a-z]+$/.test(theme)) theme = 'black';
                    let buffer = this.serialBuffers[source] || '';
                    for (let i = 0; i < value.length; ++i) {
                        switch (value.charCodeAt(i)) {
                            case 10: //'\n'
                                this.appendEntry(source, buffer, theme, sim);
                                buffer = '';
                                break;
                            case 13: //'\r'
                                break;
                            default:
                                buffer += value[i];
                                if (buffer.length > (this.maxLineLength || 255)) {
                                    this.appendEntry(source, buffer, theme, sim);
                                    buffer = ''
                                }
                                break;
                        }
                    }
                    this.serialBuffers[source] = buffer;
                }
                break;
        }
    }

    appendEntry(source: string, value: string, theme: string, sim: boolean) {
        /**
         * source: e.g., "red-1234567"
         * value: e.g., "x:123"
         * theme: e.g., "red"
         * sim: e.g., "false"
         */
        if (this.labelElement && !this.labelElement.parentElement)
            this.element.insertBefore(this.labelElement, this.element.firstElementChild);

        let ens = this.entries;
        while (ens.length > this.maxEntries) {
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
                if (last.accvalues.length > this.maxAccValues)
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
                id: Editor.counter++,
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
                e.accvaluesElement = document.createElement("span");
                e.accvaluesElement.className = "ui log " + e.theme + " gauge"
                e.chartElement = document.createElement("canvas");
                new canvaschart.CanvasChart().drawChart(e.chartElement, [new canvaschart.Point(e.accvalues[0].t, e.accvalues[0].v)])
                e.element.appendChild(e.accvaluesElement);
                e.element.appendChild(e.chartElement);
            }
            e.element.appendChild(e.valueElement);
            ens.push(e);
            this.element.appendChild(e.element);
            this.scheduleRender(e);
        }
    }

    clear() {
        this.entries = [];
        if (this.labelElement && this.labelElement.parentElement)
            this.labelElement.parentElement.removeChild(this.labelElement);
        this.element.innerHTML = '';
        this.serialBuffers = {};
    }

    scheduleRender(e: ILogEntryElement) {
        e.dirty = true;
        if (!this.renderFiberId) this.renderFiberId = setTimeout(() => this.render(), 50);
    }

    setLabel(text: string, theme?: string) {
        if (this.labelElement && this.labelElement.innerText == text) return

        if (this.labelElement) {
            if (this.labelElement.parentElement) this.labelElement.parentElement.removeChild(this.labelElement)
            this.labelElement = undefined
        }
        if (text) {
            this.labelElement = document.createElement("a")
            this.labelElement.className = `ui ${theme} top right attached mini label`
            this.labelElement.appendChild(document.createTextNode(text))
        }
    }
    render() {
        this.entries.forEach(entry => {
            if (!entry.dirty) return;

            if (entry.countElement) entry.countElement.innerText = entry.count.toString();
            if (entry.accvaluesElement) entry.accvaluesElement.innerText = entry.value;
            if (entry.chartElement) new canvaschart.CanvasChart().drawChart(entry.chartElement, entry.accvalues.map(accvalue => new canvaschart.Point(accvalue.t, accvalue.v)))
            entry.valueElement.textContent = entry.accvalues ? '' : entry.value;
            entry.dirty = false;
        });
        this.renderFiberId = 0;
    }

    display() {
        return (
            <div className="serialEditor" ref={(el) => {this.element = el}}>
                {this.entries.map(e =>
                    <div className="entry">
                        <div className="entryCount" ref={(el) => e.countElement = el}></div>
                        <div className="entryValue" ref={(el) => e.accvaluesElement = el}></div>
                        <canvas className="entryChart" ref={(el) => e.chartElement = el}></canvas>
                    </div>
                )}
            </div>
        )
    }

    domUpdate() {
        /**
        this.entries.forEach((e) => {
            if (e.chartElement) {
                new canvaschart.CanvasChart().drawChart(e.chartElement, e.accvalues.map(accvalue => new canvaschart.Point(accvalue.t, accvalue.v)))
            }
        })
        **/
    }
}

interface ILogProps {
    isSim?: boolean
    maxEntries?: number
    maxLineLength?: number
    maxAccValues?: number
}

interface ILogEntry {
    id: number
    theme: string
    variable?: string
    accvalues?: { t: number, v: number }[]
    time: number
    value: string
    source: string
    count: number
}

interface ILogEntryElement extends ILogEntry {
    dirty: boolean
    element?: HTMLDivElement
    accvaluesElement?: HTMLElement
    countElement?: HTMLSpanElement
    chartElement?: HTMLCanvasElement
    valueElement?: Text
}