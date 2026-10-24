/// <reference path="./debugProtocol.ts" />
/// <reference path="./utils.ts" />

namespace pxsim {
    export function getWarningMessage(msg: string) {
        let r: DebuggerWarningMessage = {
            type: "debugger",
            subtype: "warning",
            breakpointIds: [],
            message: msg
        }

        let s = runtime.currFrame
        while (s != null) {
            r.breakpointIds.push(s.lastBrkId)
            s = s.parent
        }

        return r
    }

    function valToJSON(v: any, heap: Map<any>) {
        switch (typeof v) {
            case "string":
            case "number":
            case "boolean":
                return v;
            case "function":
                return {
                    text: "(function)",
                    type: "function",
                }
            case "undefined":
                return null;
            case "object":
                if (!v) return null;
                if (v instanceof RefObject) {
                    if (heap) heap[(v as RefObject).id] = v;
                    let preview = RefObject.toDebugString(v);
                    let type = preview.startsWith('[') ? "array" : preview;
                    return {
                        id: (v as RefObject).id,
                        preview: preview,
                        hasFields: (v as any).fields !== null || preview.startsWith('['),
                        type: type,
                    }
                }
                if (v._width && v._height) {
                    return {
                        text: v._width + 'x' + v._height,
                        type: "image",
                    }
                }
                return {
                    text: "(object)",
                    type: "object",
                }
            default:
                throw new Error();
        }
    }

    export function dumpHeap(v: any, heap: Map<any>, fields?: string[], filters?: string[], includeAll = false): Variables {
        function frameVars(frame: any, fields?: string[]) {
            const r: Variables = {}
            for (let k of Object.keys(frame)) {
                if (!/^__/.test(k) && /___\d+$/.test(k) && (!filters || filters.indexOf(k) !== -1)) {
                    r[k] = valToJSON(frame[k], heap)
                }
            }
            if (frame.fields && fields) {
                for (let k of fields) {
                    k = k.substring(k.lastIndexOf(".") + 1);
                    r[k] = valToJSON(evalGetter(frame.vtable.iface[k], frame), heap);
                }
            }
            if (frame.fields) {
                for (let k of Object.keys(frame.fields).filter(field => includeAll || !field.startsWith('_'))) {
                    r[k] = valToJSON(frame.fields[k], heap)
                }
            }
            else if (frame instanceof RefMap) {
                for (const entry of frame.data) {
                    r[entry.key] = valToJSON(entry.val, heap);
                }
            }
            else if (Array.isArray(frame.data)) {
                (frame.data as any[]).forEach((element, index) => {
                    r[index] = valToJSON(element, heap);
                });
            }
            else if (frame._width !== undefined && frame._height !== undefined) {
                r["width"] = frame._width;
                r["height"] = frame._height;

                if (includeAll && frame._bpp !== undefined) {
                    r["isMono"] = frame._bpp === 1;
                }
            }
            return r
        }

        return frameVars(v, fields);
    }

    function evalGetter(fn: LabelFn, target: RefObject) {
        let parentFrame: any = {};
        let stackFrame: any = {
            pc: 0,
            arg0: target,
            fn,
            parent: parentFrame
        };

        while (stackFrame.fn) {
            stackFrame = stackFrame.fn(stackFrame as any);
        }

        return stackFrame.retval;
    }

    export function injectEnvironmentGlobals(msg: DebuggerBreakpointMessage, heap: Map<any>) {
        const environmentGlobals = runtime.environmentGlobals;
        const keys = Object.keys(environmentGlobals);
        if (!keys.length)
            return;

        const envVars: Variables = msg.environmentGlobals = {};
        Object.keys(environmentGlobals)
            .forEach(n => envVars[n] = valToJSON(runtime.environmentGlobals[n], heap))
    }

    export function getBreakpointMsg(s: pxsim.StackFrame, brkId: number, userGlobals?: string[]): { msg: DebuggerBreakpointMessage, heap: Map<any> } {
        const heap: pxsim.Map<any> = {};

        const msg: DebuggerBreakpointMessage = {
            type: "debugger",
            subtype: "breakpoint",
            breakpointId: brkId,
            globals: dumpHeap(runtime.globals, heap, undefined, userGlobals),
            stackframes: [],
        }

        while (s != null) {
            let info = getInfoForFrame(s, heap);
            if (info)
                msg.stackframes.push(info)
            s = s.parent
        }

        return { msg, heap };
    }

    function getInfoForFrame(s: pxsim.StackFrame, heap: any): StackFrameInfo {
        let info = s.fn ? (s.fn as any).info : null
        if (info) {
            let argInfo: FunctionArgumentsInfo = {
                thisParam: valToJSON((s as any).argL, heap),
                params: []
            };

            if (info.argumentNames) {
                const args = info.argumentNames as string[];
                argInfo.params = args.map((paramName, index) => ({
                    name: paramName,
                    value: valToJSON((s as any)["arg" + index], heap)
                }));
            }

            return {
                locals: dumpHeap(s, heap),
                funcInfo: info,
                breakpointId: s.lastBrkId,
                callLocationId: s.callLocIdx,
                arguments: argInfo
            };
        }

        return undefined;
    }
}
