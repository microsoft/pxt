namespace pxt.HWDBG {
    import Cloud = pxt.Cloud;
    import U = pxt.Util;
    import H = pxt.HF2;

    const HF2_DBG_GET_GLOBAL_STATE = 0x53fc66e0
    const HF2_DBG_RESUME = 0x27a55931
    const HF2_DBG_RESTART = 0x1120bd93
    const HF2_DBG_GET_STACK = 0x70901510

    const HF2_EV_DBG_PAUSED = 0x3692f9fd

    const r32 = H.read32

    export interface StateInfo {
        numGlobals: number;
        globalsPtr: number;
    }

    let isHalted = false
    let lastCompileResult: pxtc.CompileResult;
    let onHalted: Promise<void>;
    let haltHandler: () => void;
    let cachedStaticState: StateInfo
    let currBreakpoint: pxtc.Breakpoint;
    let callInfos: pxt.Map<ExtCallInfo>;
    let lastFlash: pxtc.UF2.ShiftedBuffer

    let hid: pxt.HF2.Wrapper

    interface ExtCallInfo {
        from: pxtc.ProcDebugInfo;
        to: pxtc.ProcDebugInfo;
        stack: number;
    }


    function taggedSpecialValue(n: number) { return (n << 2) | 2 }
    export const taggedUndefined = 0
    export const taggedNull = taggedSpecialValue(1)
    export const taggedFalse = taggedSpecialValue(2)
    export const taggedTrue = taggedSpecialValue(16)

    export let postMessage: (msg: pxsim.DebuggerMessage) => void = msg => console.log(msg)

    function clearAsync() {
        isHalted = false
        lastCompileResult = null
        cachedStaticState = null
        return Promise.resolve()
    }

    export function decodeValue(n: number): any {
        if (n & 1)
            return n >> 1

        if (n == 0)
            return undefined

        if (n & 2) {
            if (n == taggedNull) return null
            if (n == taggedFalse) return false
            if (n == taggedTrue) return true
            return { tagged: n >> 2 }
        }

        return { ptr: n }
    }

    function readMemAsync(addr: number, numbytes: number): Promise<Uint8Array> {
        U.assert(!(addr & 3))
        U.assert(addr >= 0)
        if (addr < 2 * 1024 * 1024) {
            // assume these sit in flash
            let res = new Uint8Array(numbytes)
            addr -= lastFlash.start
            U.memcpy(res, 0, lastFlash.buf, addr, numbytes)
            return Promise.resolve(res)
        }
        let maxBytes = hid.maxMsgSize - 32
        if (numbytes > maxBytes) {
            let promises: Promise<Uint8Array>[] = []
            while (numbytes > 0) {
                let n = Math.min(maxBytes, numbytes)
                promises.push(readMemAsync(addr, n))
                numbytes -= n
                addr += n
            }
            return Promise.all(promises)
                .then(U.uint8ArrayConcat)
        } else {
            return hid.readWordsAsync(addr, Math.ceil(numbytes / 4))
                .then(rr => {
                    if (rr.length > numbytes)
                        return rr.slice(0, numbytes)
                    else
                        return rr
                })
        }
    }

    export function heapExpandAsync(v: any): Promise<any> {
        if (typeof v != "object" || !v) return Promise.resolve(v)
        if (typeof v.ptr == "number") {
            // there should be no unaligned pointers
            if (v.ptr & 3)
                return Promise.resolve({ unalignedPtr: v.ptr })
            let tag = 0
            // 56 bytes of data fit in one HID packet (with 5 bytes of header and 3 bytes of padding)
            return readMemAsync(v.ptr, 56)
                .then(buf => {
                    // TODO this is wrong, with the new vtable format
                    tag = H.read16(buf, 2)
                    let neededLength = buf.length
                    if (tag == pxt.BuiltInType.BoxedString || tag == pxt.BuiltInType.BoxedBuffer) {
                        neededLength = H.read16(buf, 4) + 6
                    } else if (tag == pxt.BuiltInType.BoxedNumber) {
                        neededLength = 8 + 4
                    } else {
                        // TODO
                    }
                    if (neededLength > buf.length) {
                        return readMemAsync(v.ptr + buf.length, neededLength - buf.length)
                            .then(secondary => U.uint8ArrayConcat([buf, secondary]))
                    } else if (neededLength < buf.length) {
                        return buf.slice(0, neededLength)
                    } else {
                        return buf
                    }
                })
                .then<any>(buf => {
                    if (tag == pxt.BuiltInType.BoxedString)
                        return U.uint8ArrayToString(buf.slice(6))
                    else if (tag == pxt.BuiltInType.BoxedBuffer)
                        return { type: "buffer", data: buf.slice(6) }
                    else if (tag == pxt.BuiltInType.BoxedNumber)
                        return new Float64Array(buf.buffer.slice(4))[0]
                    else
                        return {
                            type: "unknown",
                            tag: tag,
                            refcnt: H.read16(buf, 0),
                            data: buf.slice(4)
                        }
                })
        } else {
            return Promise.resolve(v)
        }
    }

    export function heapExpandMapAsync(vars: pxsim.Variables) {
        let promises: Promise<void>[] = []
        for (let k of Object.keys(vars)) {
            promises.push(heapExpandAsync(vars[k])
                .then((r: any) => {
                    vars[k] = r
                    //console.log("set", k, "to", r, "prev", vars[k], "NOW", vars)
                }))
        }
        return Promise.all(promises)
            .then(() => {
                //console.log("FIN", vars)
            })
    }

    function buildFrames(stack: number[], msg: pxsim.DebuggerBreakpointMessage) {
        let currAddr = currBreakpoint.binAddr
        let sp = 0
        let pi = lastCompileResult.procDebugInfo.filter(p =>
            p.codeStartLoc <= currAddr && currAddr <= p.codeEndLoc)[0]

        while (true) {
            if (!pi)
                break // ???
            if (pi == lastCompileResult.procDebugInfo[0])
                break // main

            let bp = findPrevBrkp(currAddr)
            let info = U.clone(bp) as any as pxtc.FunctionLocationInfo
            info.functionName = pi.name
            msg.stackframes.push({
                locals: {},
                funcInfo: info,
                breakpointId: bp.id,
            })
            let frame = msg.stackframes[msg.stackframes.length - 1]
            let idx = 0
            for (let l of pi.locals) {
                U.assert(l.index == idx++)
                frame.locals[l.name] = decodeValue(stack[sp++])
            }
            currAddr = stack[sp++] & 0x7ffffffe
            let ci = callInfos[currAddr + ""]
            for (let l of pi.args) {
                frame.locals[l.name] = decodeValue(stack[sp + (pi.args.length - 1 - l.index)])
            }

            if (!ci) break

            pi = ci.from
            sp += ci.stack - pi.localsMark
        }
    }

    function findPrevBrkp(addr: number) {
        let bb = lastCompileResult.breakpoints
        let brkMatch = bb[0]
        let bestDelta = Infinity
        for (let b of bb) {
            let delta = addr - b.binAddr
            // console.log(`${b.line+1}: addr=${b.binAddr} d=${delta}`)
            if (delta >= 0 && delta < bestDelta) {
                bestDelta = delta
                brkMatch = b
            }
        }
        return brkMatch
    }

    function corePaused(buf: Uint8Array) {
        if (isHalted) return Promise.resolve()
        isHalted = true
        let msg: pxsim.DebuggerBreakpointMessage
        return getHwStateAsync()
            .then(st => {
                let w = H.decodeU32LE(buf)
                let pc = w[0]

                let globals: pxsim.Variables = {}

                for (let l of lastCompileResult.procDebugInfo[0].locals) {
                    let gbuf = st.globals

                    let readV = () => {
                        switch (l.type) {
                            case "uint32": return H.read32(gbuf, l.index)
                            case "int32": return H.read32(gbuf, l.index) | 0
                            case "uint16": return H.read16(gbuf, l.index)
                            case "int16": return (H.read16(gbuf, l.index) << 16) >> 16
                            case "uint8": return gbuf[l.index]
                            case "int8": return (gbuf[l.index] << 24) >> 24
                            default: return null
                        }
                    }

                    let v: any = readV()
                    if (v === null) {
                        U.assert((l.index & 3) == 0)
                        v = decodeValue(H.read32(gbuf, l.index))
                    }
                    globals[l.name] = v
                }

                currBreakpoint = findPrevBrkp(pc)
                msg = {
                    type: 'debugger',
                    subtype: 'breakpoint',
                    breakpointId: currBreakpoint.id,
                    globals: globals,
                    stackframes: []
                }

                haltHandler()
                return hid.talkAsync(HF2_DBG_GET_STACK)
            })
            .then(stack => {
                buildFrames(H.decodeU32LE(stack), msg);
                let maps = [msg.globals].concat(msg.stackframes.map(s => s.locals))
                return Promise.map(maps, heapExpandMapAsync)
            })
            .then(() => postMessage(msg))
    }

    function clearHalted() {
        isHalted = false
        onHalted = new Promise<void>((resolve, reject) => {
            haltHandler = resolve
        })
    }

    export function startDebugAsync(compileRes: pxtc.CompileResult, hidWr: H.Wrapper) {
        hid = hidWr
        hid.onEvent(HF2_EV_DBG_PAUSED, corePaused)

        return clearAsync()
            .then(() => {
                lastCompileResult = compileRes
                callInfos = {}

                let procLookup: pxtc.ProcDebugInfo[] = []
                for (let pdi of compileRes.procDebugInfo) {
                    procLookup[pdi.idx] = pdi
                }
                for (let pdi of compileRes.procDebugInfo) {
                    //console.log(pdi)
                    for (let ci of pdi.calls) {
                        callInfos[ci.addr + ""] = {
                            from: pdi,
                            to: procLookup[ci.procIndex],
                            stack: ci.stack
                        }
                    }
                }
            })
            .then(() => {
                let f = lastCompileResult.outfiles[pxtc.BINARY_UF2]
                let blockBuf = U.stringToUint8Array(atob(f))
                lastFlash = pxtc.UF2.toBin(blockBuf)
                let blocks = pxtc.UF2.parseFile(blockBuf)
                return hid.reflashAsync(blocks) // this will reset into app at the end
            })
            .then(() => hid.talkAsync(HF2_DBG_RESTART).catch(e => { }))
            .then(() => Promise.delay(200))
            .then(() => hid.reconnectAsync())
            .then(clearHalted)
            .then(waitForHaltAsync)
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
                resumeAsync(stepInto)
                break
        }
    }

    export function resumeAsync(into = false) {
        return Promise.resolve()
            .then(() => hid.talkAsync(HF2_DBG_RESUME, H.encodeU32LE([into ? 1 : 3])))
            .then(clearHalted)
    }

    export interface HwState {
        staticState: StateInfo;
        globals: Uint8Array;
    }

    export function waitForHaltAsync() {
        if (!onHalted) onHalted = Promise.resolve();
        return onHalted
    }

    function getStaticStateAsync() {
        if (cachedStaticState) return Promise.resolve(cachedStaticState)
        return hid.talkAsync(HF2_DBG_GET_GLOBAL_STATE)
            .then(buf => (cachedStaticState = {
                numGlobals: r32(buf, 0),
                globalsPtr: r32(buf, 4)
            }))
    }

    export function getHwStateAsync() {
        return getStaticStateAsync()
            .then(st => hid.readWordsAsync(st.globalsPtr, st.numGlobals))
            .then(buf => {
                let res: HwState = {
                    staticState: cachedStaticState,
                    globals: buf
                }
                return res
            })
    }

}