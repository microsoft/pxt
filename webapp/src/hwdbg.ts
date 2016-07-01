import * as workspace from "./workspace";
import * as data from "./data";
import * as pkg from "./package";
import * as core from "./core";
import * as compiler from "./compiler"
import * as workeriface from "./workeriface"

import Cloud = pxt.Cloud;
import U = pxt.Util;

let iface: workeriface.Iface


export interface MachineState {
    registers: number[];
    stack: number[];
}

function init() {
    if (!iface) {
        if (!/^http:\/\/localhost/i.test(window.location.href) || !Cloud.localToken)
            return;
        pxt.debug('initializing debug pipe');
        iface = workeriface.makeWebSocket('ws://localhost:3233/' + Cloud.localToken + '/debug')
    }
}

export function readMemAsync(addr: number, numwords: number) {
    return workerOpAsync("mem", { addr: addr, words: numwords })
        .then(resp => resp.data as number[])
}

let asm = ""
function callAndPush(prc: string) {
    let idx = asm.length
    asm += `
    ldr r4, .proc${idx}
    blx r4
    push {r0}
    b .next${idx}
    .balign 4
.proc${idx}:
    .word ${prc}|1
.next${idx}:
`
}

let stateProcs = [
    "pxtrt::getNumGlobals/numGlobals",
    "pxtrt::getGlobalsPtr/globalsPtr",
]

interface StateInfo {
    numGlobals: number;
    globalsPtr: number;
}

function callForStateAsync() {
    asm = ""

    for (let p of stateProcs) {
        callAndPush(p.replace(/\/.*/, ""))
    }

    asm += `
    bkpt 42
    @nostackcheck
`

    return compiler.compileAsync({ native: true })
        .then(() => compiler.assembleAsync(asm))
        .then(res => workerOpAsync("exec", { code: res.words, args: [] }))
        .then(() => snapshotAsync())
        .then(st => {
            let fields = stateProcs.map(s => s.replace(/.*\//, ""))
            fields.reverse()
            let r: any = {}
            fields.forEach((f, i) => {
                r[f] = st.stack[i]
            })
            return r as StateInfo
        })
}

export function snapshotAsync(): Promise<MachineState> {
    return workerOpAsync("snapshot")
        .then(r => r.state as MachineState)
}

export function restoreAsync(st: MachineState): Promise<void> {
    return workerOpAsync("restore", { state: st })
        .then(() => { })
}

export interface HwState {
    machineState: MachineState;
    globals: number[];
}

export function getHwStateAsync() {
    let res: HwState = {
        machineState: null,
        globals: []
    }
    return workerOpAsync("halt")
        .then(() => workerOpAsync("snapshot"))
        .then(v => {
            res.machineState = v.state
            return callForStateAsync()
        })
        .then(info =>
            info.numGlobals > 0 ?
                readMemAsync(info.globalsPtr, info.numGlobals) :
                Promise.resolve([] as number[]))
        .then(g => {
            res.globals = g
        })
        .then(() => restoreAsync(res.machineState))
        .then(() => workerOpAsync("resume"))
        .then(() => res)
}

let devPath: Promise<string>;

export function workerOpAsync(op: string, arg: any = {}) {
    init()
    if (!devPath)
        devPath = iface.opAsync("list", {})
            .then((devs: any) => {
                let d0 = devs.devices[0]
                if (d0) return d0.path
                else throw new Error("No device connected")
            })
    return devPath
        .then(path => {
            arg["path"] = path;
            return iface.opAsync(op, arg)
        })
}

