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

interface WorkspaceClickCoordinate extends WorkspaceCoordinate {
    exactTick: number;
}

interface WorkspaceSelectionState {
    originalSong: pxt.assets.music.Song;
    startTick: number;
    endTick: number;

    deltaTick: number;
    transpose: number;

    pastedContent?: WorkspaceSelectionState;
}