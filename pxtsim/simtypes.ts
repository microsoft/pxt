namespace pxsim {
    export enum SimulatorState {
        Unloaded,
        Stopped,
        Pending,
        Starting,
        Running,
        Paused,
        Suspended
    }

    export enum SimulatorDebuggerCommand {
        StepInto,
        StepOver,
        StepOut,
        Resume,
        Pause
    }

    export interface SimulatorRunOptions {
        debug?: boolean;
        trace?: boolean;
        boardDefinition?: pxsim.BoardDefinition;
        parts?: string[];
        builtinParts?: string[];
        fnArgs?: any;
        aspectRatio?: number;
        partDefinitions?: pxsim.Map<PartDefinition>;
        mute?: boolean;
        highContrast?: boolean;
        light?: boolean;
        cdnUrl?: string;
        localizedStrings?: pxsim.Map<string>;
        refCountingDebug?: boolean;
        version?: string;
        clickTrigger?: boolean;
        breakOnStart?: boolean;
        storedState?: Map<any>;
        autoRun?: boolean;
        ipc?: boolean;
        dependencies?: Map<string>;
        // single iframe, no message simulators
        single?: boolean;
        hideSimButtons?: boolean;
        autofocus?: boolean;
        queryParameters?: string;
        mpRole?: "server" | "client";
        activePlayer?: 1 | 2 | 3 | 4 | undefined;
        theme?: string | pxt.Map<string>;
    }

    export interface HwDebugger {
        postMessage: (msg: pxsim.SimulatorMessage) => void;
    }
}
