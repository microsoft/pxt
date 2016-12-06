namespace pxsim {
    // type=debugger
    export interface DebuggerMessage extends SimulatorMessage {
        subtype: string;
    }

    // subtype=config
    export interface DebuggerConfigMessage extends DebuggerMessage {
        setBreakpoints?: number[];
    }

    export type BreakpointMap = {[index: string]: [number, DebugProtocol.Breakpoint][]};

    // subtype=resume
    // subtype=stepover
    // subtype=stepinto

    //
    // Responses from simulator
    //

    // subtype=breakpoint
    export interface DebuggerBreakpointMessage extends DebuggerMessage {
        breakpointId: number;
        globals: Variables;
        stackframes: {
            locals: Variables;
            funcInfo: any; // pxtc.FunctionLocationInfo
            breakpointId: number;
        }[];
        exceptionMessage?: string;
        exceptionStack?: string;
    }

    export interface DebuggerWarningMessage extends DebuggerMessage {
        message: string;
        breakpointIds: number[];
    }

    export interface Variables {
        [name: string]: any;
    }

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

    export function getBreakpointMsg(s: StackFrame, brkId: number) {
        function valToJSON(v: any) {
            switch (typeof v) {
                case "string":
                case "number":
                case "boolean":
                    return v;
                case "function":
                    return { text: "(function)" }
                case "undefined":
                    return null;
                case "object":
                    if (!v) return null;
                    if (v instanceof RefObject)
                        return { id: (v as RefObject).id }
                    return { text: "(object)" }
                default:
                    throw new Error();
            }
        }

        function frameVars(frame: Variables) {
            let r: Variables = {}
            for (let k of Object.keys(frame)) {
                if (/___\d+$/.test(k)) {
                    r[k] = valToJSON(frame[k])
                }
            }
            return r
        }

        let r: DebuggerBreakpointMessage = {
            type: "debugger",
            subtype: "breakpoint",
            breakpointId: brkId,
            globals: frameVars(runtime.globals),
            stackframes: []
        }

        while (s != null) {
            let info = s.fn ? (s.fn as any).info : null
            if (info)
                r.stackframes.push({
                    locals: frameVars(s),
                    funcInfo: info,
                    breakpointId: s.lastBrkId
                })
            s = s.parent
        }

        return r
    }

    function binarySearch<T>(list: T[], target: T, compare: (a: T, b: T) => number): T {
        if (!list || list.length === 0) {
            return undefined;
        }

        return bSearchRecursive(0, list.length);

        function bSearchRecursive(start: number, end: number): T {
            if (end - start < 0) {
                return undefined;
            }

            const middle = start + Math.floor((end - start) / 2);
            const comp = compare(target, list[middle]);

            if (comp === 0) {
                return list[middle];
            }
            else if (comp > 0 && middle !== start) {
                return bSearchRecursive(middle + 1, end);
            }
            else if (comp < 0 && middle !== end) {
                return bSearchRecursive(start, middle);
            }
            else {
                return undefined;
            }
        }
    }
}
