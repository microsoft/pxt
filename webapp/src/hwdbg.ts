import * as workspace from "./workspace";
import * as data from "./data";
import * as pkg from "./package";
import * as core from "./core";
import * as compiler from "./compiler"
import * as workeriface from "./workeriface"

import Cloud = pxt.Cloud;
import U = pxt.Util;

let iface: workeriface.Iface
let isHalted = false
let lastCompileResult: ts.pxt.CompileResult;
let haltCheckRunning = false
let onHalted = Promise.resolve();
let haltHandler: () => void;
let cachedStateInfo: StateInfo
let nextBreakpoints: number[] = []
let currBreakpoint: ts.pxt.Breakpoint;
let lastDebugStatus: number;
let callInfos: U.Map<ExtCallInfo>;

interface ExtCallInfo {
    from: ts.pxt.ProcDebugInfo;
    to: ts.pxt.ProcDebugInfo;
    stack: number;
}


export var postMessage: (msg: pxsim.DebuggerMessage) => void;

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

export function writeMemAsync(addr: number, words: number[]) {
    return workerOpAsync("wrmem", { addr: addr, words: words })
        .then(() => { })
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

function callForStateAsync(st: MachineState) {
    if (cachedStateInfo) return Promise.resolve(cachedStateInfo)

    asm = ""

    for (let p of stateProcs) {
        callAndPush(p.replace(/\/.*/, ""))
    }

    asm += `
    bkpt 42
    @nostackcheck
`

    return compiler.assembleAsync(asm)
        .then(res => workerOpAsync("exec", { code: res.words, args: [] }))
        .then(() => snapshotAsync())
        .then(st => {
            let fields = stateProcs.map(s => s.replace(/.*\//, ""))
            fields.reverse()
            let r: any = {}
            fields.forEach((f, i) => {
                r[f] = st.stack[i]
            })
            cachedStateInfo = r
        })
        .then(() => restoreAsync(st))
        .then(() => cachedStateInfo)
}

function clearAsync() {
    isHalted = false
    lastCompileResult = null
    cachedStateInfo = null
    lastDebugStatus = null
    return Promise.resolve()
}

function coreHalted() {
    return getHwStateAsync()
        .then(st => {
            nextBreakpoints = []

            let globals: pxsim.Variables = {}
            st.globals.slice(1).forEach((v, i) => {
                let loc = lastCompileResult.procDebugInfo[0].locals[i]
                if (loc)
                    globals[loc.name] = v
                else
                    globals["?" + i] = v
            })
            
            let pc = st.machineState.registers[15]

            let final = () => Promise.resolve()

            let stepInBkp = lastCompileResult.procDebugInfo.filter(p => p.bkptLoc == pc)[0]
            if (stepInBkp) {
                pc = stepInBkp.codeStartLoc
                st.machineState.registers[15] = pc
                final = () => restoreAsync(st.machineState)
            }

            let bb = lastCompileResult.breakpoints
            let brkMatch = bb[0]
            let bestDelta = Infinity
            for (let b of bb) {
                let delta = pc - b.binAddr
                if (delta >= 0 && delta < bestDelta) {
                    bestDelta = delta
                    brkMatch = b
                }
            }
            currBreakpoint = brkMatch
            let msg: pxsim.DebuggerBreakpointMessage = {
                type: 'debugger',
                subtype: 'breakpoint',
                breakpointId: brkMatch.id,
                globals: globals,
                stackframes: []
            }
            postMessage(msg)
            return final()
        })
        .then(haltHandler)
}

function haltCheckAsync(): Promise<void> {
    if (isHalted)
        return Promise.delay(100).then(haltCheckAsync)
    return workerOpAsync("status")
        .then(res => {
            if (res.isHalted) {
                isHalted = true
                coreHalted()
            }
            return Promise.delay(300)
        })
        .then(haltCheckAsync)
}

function clearHalted() {
    isHalted = false
    onHalted = new Promise<void>((resolve, reject) => {
        haltHandler = resolve
    })
    if (!haltCheckRunning) {
        haltCheckRunning = true
        haltCheckAsync()
    }
}

function writeDebugStatusAsync(v: number) {
    if (v === lastDebugStatus) return Promise.resolve()
    lastDebugStatus = v
    return writeMemAsync(cachedStateInfo.globalsPtr, [v])
}

function setBreakpointsAsync(addrs: number[]) {
    return workerOpAsync("breakpoints", { addrs: addrs })
}

export function startDebugAsync() {
    return clearAsync()
        .then(() => compiler.compileAsync({ native: true }))
        .then(res => {
            lastCompileResult = res
            callInfos = {}

            let procLookup: ts.pxt.ProcDebugInfo[] = []
            for (let pdi of res.procDebugInfo) {
                procLookup[pdi.idx] = pdi
            }
            for (let pdi of res.procDebugInfo) {
                for (let ci of pdi.calls) {
                    callInfos[ci.addr + ""] = {
                        from: pdi,
                        to: procLookup[ci.procIndex],
                        stack: ci.stack
                    }
                }
            }

            let bb = lastCompileResult.breakpoints
            let entry = bb[1]
            for (let b of bb) {
                if (b.binAddr && b.binAddr < entry.binAddr)
                    entry = b
            }
            return setBreakpointsAsync([entry.binAddr])
        })
        .then(() => workerOpAsync("reset"))
        .then(clearHalted)
        .then(waitForHaltAsync)
        .then(res => writeDebugStatusAsync(1).then(() => res))
}

export function handleMessage(msg: pxsim.DebuggerMessage) {
    console.log("HWDBGMSG", msg)
    if (msg.type != "debugger")
        return
    let stepInto = false
    switch (msg.subtype) {
        case 'stepinto':
            stepInto = true
        case 'stepover':
            nextBreakpoints = currBreakpoint.successors.map(id => lastCompileResult.breakpoints[id].binAddr)
            resumeAsync(stepInto)
            break
    }
}

export function snapshotAsync(): Promise<MachineState> {
    return workerOpAsync("snapshot")
        .then(r => r.state as MachineState)
}

export function restoreAsync(st: MachineState): Promise<void> {
    return workerOpAsync("restore", { state: st })
        .then(() => { })
}

export function resumeAsync(into = false) {
    return Promise.resolve()
        .then(() => writeDebugStatusAsync(into ? 3 : 1))
        .then(() => setBreakpointsAsync(nextBreakpoints))
        .then(() => workerOpAsync("resume"))
        .then(clearHalted)
}

export interface HwState {
    machineState: MachineState;
    globals: number[];
}

export function waitForHaltAsync() {
    U.assert(haltCheckRunning)
    return onHalted
}

export function getHwStateAsync() {
    let res: HwState = {
        machineState: null,
        globals: []
    }
    return snapshotAsync()
        .then(v => {
            res.machineState = v
            return callForStateAsync(v)
        })
        .then(info => readMemAsync(info.globalsPtr, info.numGlobals))
        .then(g => {
            res.globals = g
            return res
        })
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

