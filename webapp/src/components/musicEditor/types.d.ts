namespace pxt.assets.music {
    export interface Track {
        iconURI: string;
        name: string;
    }

    export interface Instrument {
        octave: number;
    }
}

interface MetronomeMessage {
    type: "start" | "stop" | "set-interval";
    interval?: number;
}

interface WorkspaceCoordinate {
    tick: number;
    row: number;
}