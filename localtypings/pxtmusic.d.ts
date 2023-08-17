declare namespace pxt.assets.music {
    export interface Instrument {
        waveform: number;
        ampEnvelope: Envelope;
        pitchEnvelope?: Envelope;
        ampLFO?: LFO;
        pitchLFO?: LFO;
        octave?: number;
    }

    export interface Envelope {
        attack: number;
        decay: number;
        sustain: number;
        release: number;
        amplitude: number;
    }

    export interface LFO {
        frequency: number;
        amplitude: number;
    }

    export interface SongInfo {
        measures: number;
        beatsPerMeasure: number;
        beatsPerMinute: number;
        ticksPerBeat: number;
    }

    export interface Song extends SongInfo {
        tracks: Track[];
    }

    export interface Track {
        instrument: Instrument;
        id: number;
        name?: string;
        iconURI?: string;
        drums?: DrumInstrument[];
        notes: NoteEvent[];
    }

    export interface NoteEvent {
        notes: Note[];
        startTick: number;
        endTick: number;
    }

    export interface Note {
        note: number;
        enharmonicSpelling: "normal" | "flat" | "sharp";
    }

    export interface DrumSoundStep {
        waveform: number;
        frequency: number;
        volume: number;
        duration: number;
    }

    export interface DrumInstrument {
        startFrequency: number;
        startVolume: number;
        steps: DrumSoundStep[];
    }
}