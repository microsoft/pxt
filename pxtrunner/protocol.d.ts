declare namespace pxt.runner {
    export enum SimulatorState {
        Unloaded = 0,
        Stopped = 1,
        Running = 2,
        Paused = 3,
    }

    export interface Variables {
        [name: string]: any;
    }

    export interface LocationInfo {
        fileName: string;
        start: number;
        length: number;
        line: number;
        character: number;
    }

    export interface Breakpoint extends LocationInfo {
        id: number;
        isDebuggerStmt: boolean;
        successors: number[];
        binAddr?: number;
    }

    export interface SimulatorMessage {
        messageId?: number;
        type: string;
    }

    export interface DebuggerMessage extends SimulatorMessage {
        type: "debugger";
        subtype: string;
    }

    export interface ReadyMessage {
        type: "ready";
    }
    /**
     * Events sent by the target being debugged
     */
    export namespace Events.Debug {
        export interface DebuggerBreakpointMessage extends DebuggerMessage {
            subtype:"breakpoint";
            breakpointId: number;
            globals: Variables;
            stackframes: {
                locals: Variables;
                funcInfo: any;
                breakpointId: number;
            }[];
            exceptionMessage?: string;
            exceptionStack?: string;
        }

        export interface DebuggerWarningMessage extends DebuggerMessage {
            subtype:"warning";
            message: string;
            breakpointIds: number[];
        }

        export interface BreakpointsSet extends DebuggerMessage {
            subtype:"breakpointsset";
        }
    }

    /**
     * Events specific to the simulator
     */
    export namespace Events.Sim {
        export interface StateChanged {
            type: "simstate";
            state: number;
        }
    }

    /**
     * Commands to send to the debug target
     */
    export namespace Commands.Debug {
        export interface DebuggerConfigMessage extends DebuggerMessage {
            subtype: "config";
            setBreakpoints?: number[];
        }
    }

    /**
     * Commands specific to the simulator
     */
    export namespace Commands.Sim {
        export interface CompiledJsInfo {
            code: string;
            usedParts: string[];
            usedArguments: { [index: string]: string };
            breakpoints: Breakpoint[];
        }

        export interface SetCodeMessage extends SimulatorMessage, CompiledJsInfo {
            type: "setcode";
        }
    }
}