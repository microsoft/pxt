namespace pxsim {
    // type=debugger
    export interface DebuggerMessage extends SimulatorMessage {
        subtype: string;
    }

    // subtype=config
    export interface DebuggerConfigMessage extends DebuggerMessage {
        setBreakpoints?: number[];
    }

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
        }[];
        exceptionMessage?: string;
        exceptionStack?: string;
    }

    export interface Variables {
        [name: string]: any;
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
                    funcInfo: info
                })
            s = s.parent
        }

        return r
    }
}
