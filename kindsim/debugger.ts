namespace ks.rt {
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
    }
}
