namespace pxt.runner {
    export enum DebugMessageType {
        ready = 1,
        runcode = 2,
        simstate = 3
    }

    export enum SimulatorState {
        Unloaded = 0,
        Stopped = 1,
        Running = 2,
        Paused = 3,
    }

    export interface BuildResult {
        code: string;
        usedParts: string[];
        usedArguments: { [index: string]: string }
    }

    export interface DebugMessage {
        id: DebugMessageType;
    }

    export interface RuncodeMessage extends DebugMessage, BuildResult { }

    export interface SimStateMessage extends DebugMessage {
        state: SimulatorState;
    }
}