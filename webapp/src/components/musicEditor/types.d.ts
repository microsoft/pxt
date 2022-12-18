namespace pxt.assets.music {
    export interface Track {
        iconURI: string;
        name: string;
    }

    export interface Instrument {
        octave: number;
    }

    export interface NoteEvent {
        selected?: boolean;
    }
}

interface MetronomeMessage {
    type: "start" | "stop" | "set-interval";
    interval?: number;
}

interface WorkspaceCoordinate {
    isBassClef: boolean;
    tick: number;
    row: number;
}

interface WorkspaceRange {
    start: WorkspaceCoordinate;
    end: WorkspaceCoordinate;
}