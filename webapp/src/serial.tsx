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
    //?
    static counter = 0
    private graphEntries: ILogEntryElement[] = []
    private consoleEntries: IConsoleEntry[] = []
    private consoleBuffer: string = ""

    public element: HTMLDivElement
    private labelElement: HTMLElement
    private graphElement: HTMLElement
    private consoleElement: HTMLElement

    // TODO this!
    // TODO pass these values in with props or config?
    private shouldScroll = false
    private isSim: boolean = true
    private maxEntries: number = 80
    private maxLineLength: number = 500
    private maxAccValues: number = 500
    private renderFiberId: number
    private maxConsoleEntries: number = 20

    private active: boolean = true

    acceptsFile(file: pkg.File) {
        // TODO hardcoded string
        return file.name === "serial.json"
    }

    isGraphable(v: string) {
        return /[a-z]*:[0-9.]*/.test(v)
    }
    
    setSim(b: boolean) {
        this.isSim = b
        this.clear()
        //TODO not working
        this.setLabel(this.isSim ? lf("SIM") : lf("DEV"))
    }

    constructor(public parent: pxt.editor.IProjectView) {
        super(parent)
        window.addEventListener("message", this.processMessage.bind(this), false)
    }

    processMessage(ev: MessageEvent) {
        let msg = ev.data
        if (this.active && msg.type === "serial") {
            const smsg = msg as pxsim.SimulatorSerialMessage
            const sim = !!smsg.sim
            if (sim == this.isSim) {
                const data = smsg.data || ""
                const source = smsg.id || "?"
                let theme = source.split("-")[0] || "black"

                if (this.isGraphable(data)) {
                    this.appendGraphEntry(source, data, theme, sim)
                } else {
                    this.appendConsoleEntry(data)
                }
            }
        }
    }

    appendGraphEntry(source: string, data: string, theme: string, sim: boolean) {
        //TODO consolidate with other regex - have isGraphable return split data
        let m = /^\s*(([^:]+):)?\s*(-?\d+)/i.exec(data)
        let variable = m ? (m[2] || ' ') : undefined
        let nvalue = m ? parseInt(m[3]) : null

        let last: ILogEntryElement = undefined
        for (let i = 0; i < this.graphEntries.length; ++i) {
            let graph = this.graphEntries[i]
            if (graph.source === source && graph.variable === variable) {
                last = graph
                break
            }
        }

        if (last) {
            last.dirty = true
            last.data = data
            last.accvalues.push({
                t: Date.now() - last.time,
                v: nvalue
            })
            if (last.accvalues.length > this.maxAccValues) {
                last.accvalues.shift()
            }
        } else {
            let graph: ILogEntryElement = {
                dirty: true,
                theme: theme,
                variable: variable,
                data: data,
                accvalues: [{t: 0, v: nvalue}],
                time: Date.now(),
                source: source
            }
            this.graphEntries.push(graph)
        }
        this.scheduleRender()
    }

    appendConsoleEntry(data: string) {
        for (let i = 0; i < data.length; ++i) {
            let ch = data[i]
            this.consoleBuffer += ch
            if (ch === "\n" || this.consoleBuffer.length > this.maxLineLength) {
                let consoleEntry: IConsoleEntry = {
                    data: this.consoleBuffer,
                    dirty: true
                }
                this.consoleEntries.push(consoleEntry)
                this.consoleBuffer = ""
                while (this.consoleEntries.length > this.maxConsoleEntries) {
                    let po = this.consoleEntries.shift();
                    if (po.element && po.element.parentElement) po.element.parentElement.removeChild(po.element);
                }
                this.scheduleRender()
            }
        }
    }

    clear() {
        this.graphEntries = [];
        if (this.labelElement && this.labelElement.parentElement)
            this.labelElement.parentElement.removeChild(this.labelElement)
        if (this.consoleElement)
            this.consoleElement.innerHTML = ""
        if (this.graphElement)
            this.graphElement.innerHTML = ""
        this.consoleEntries.forEach(e => {
            if (e.element && e.element.parentElement) e.element.parentElement.removeChild(e.element)
        })
        this.graphEntries.forEach(e => {
            if (e.dataElement && e.dataElement.parentElement) e.dataElement.parentElement.removeChild(e.dataElement)
            if (e.canvasElement && e.canvasElement.parentElement) e.canvasElement.parentElement.removeChild(e.canvasElement)
            if (e.element && e.element.parentElement) e.element.parentElement.removeChild(e.element)
        })
        this.consoleBuffer = ""
    }

    scheduleRender() {
        if (!this.renderFiberId) this.renderFiberId = setTimeout(() => this.render(), 50);
    }

    render() {
        this.consoleEntries.forEach(e => {
            if (!e.dirty) return
            let consoleDiv = document.createElement("div")
            consoleDiv.className = "coconut"
            consoleDiv.textContent = e.data
            e.element = consoleDiv
            this.consoleElement.appendChild(consoleDiv)
            e.dirty = false
        })

        this.graphEntries.forEach(e => {
            if (!e.dirty) return
            if (!e.element) {
                let graphDiv = document.createElement("div")
                graphDiv.className = "guava"
                let labelDiv = document.createElement("div")
                labelDiv.className = "lemon"
                let canvas = document.createElement("canvas")
                canvas.className = "coconut"
                //TODO hacky
                canvas.setAttribute("width", "1000px")
                graphDiv.appendChild(labelDiv)
                graphDiv.appendChild(canvas)
                e.element = graphDiv
                e.canvasElement = canvas
                e.dataElement = labelDiv
                this.graphElement.appendChild(graphDiv)
            }
            //TODO dk about this
            e.canvasElement.innerHTML = ""
            new canvaschart.CanvasChart().drawChart(e.canvasElement, e.accvalues.map(accvalue => new canvaschart.Point(accvalue.t, accvalue.v)))
            e.dirty = false
        })
        this.renderFiberId = 0
    }

    display() {
        return (
            <div className="serialEditor" ref={(el) => {this.element = el}}>
                <sui.Button text={lf("Start")} onClick= {() => this.active = true} />
                <sui.Button text={lf("Stop")} onClick = {() => this.active = false} />
                <div className="graphs" ref={(el) => {this.graphElement = el}}></div>
                <div className="console" ref={(el) => {this.consoleElement = el}}></div>
            </div>
        )
    }

    domUpdate() {
        this.scheduleRender()
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
}

interface ILogEntry {
    //TODO get rid of some of these fields
    id?: number
    theme: string
    variable?: string
    accvalues: { t: number, v: number }[]
    time: number
    data: string
    source: string
    count?: number
}

interface ILogEntryElement extends ILogEntry {
    dirty: boolean
    element?: HTMLDivElement
    canvasElement?: HTMLCanvasElement
    dataElement?: HTMLDivElement
}

interface IConsoleEntry {
    data: string
    dirty: boolean
    element?: HTMLElement
}