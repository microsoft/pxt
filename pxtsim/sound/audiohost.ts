// Audio abstraction for the DOM-free core. The browser bundle registers a Web Audio
// implementation (see audiohostdom.ts); without one, audio calls are silent no-ops.
namespace pxsim.audiohost {
    export interface SoundOscilloscopeData {
        data: Float32Array;
        fft: Uint8Array;
    }

    export interface SoundSnapshotData {
        frequency: number;
        volume: number;
    }

    export type SoundPreviewCallback = (data: SoundOscilloscopeData | SoundSnapshotData) => void;

    /** Periodic tick source used by the music sequencer. */
    export interface Metronome {
        initAsync(): any;
        start(interval: number): void;
        stop(): void;
        setInterval(interval: number): void;
        addTickListener(listener: () => void): void;
        dispose(): void;
    }

    export interface SpatialAudioPlayer {
        playInstructionsAsync(instructions: Uint8Array): Promise<void>;
    }

    export interface AudioHost {
        stopAll(): void;
        mute(mute: boolean): void;
        playInstructionsAsync(instructions: Uint8Array, isCancelled?: () => boolean, onPull?: SoundPreviewCallback): Promise<void>;
        playPCMBufferStreamAsync(pull: () => Float32Array, sampleRate: number, volume?: number, isCancelled?: () => boolean): Promise<void>;
        setListenerPosition(x: number, y: number, z: number): void;
        disposeAllSpatialAudioPlayers(): void;
        createMetronome(): Metronome;
    }

    const silentMetronome = (): Metronome => ({
        initAsync: () => Promise.resolve(),
        start: () => { },
        stop: () => { },
        setInterval: () => { },
        addTickListener: () => { },
        dispose: () => { }
    });

    const silentHost: AudioHost = {
        stopAll: () => { },
        mute: () => { },
        playInstructionsAsync: () => Promise.resolve(),
        playPCMBufferStreamAsync: () => Promise.resolve(),
        setListenerPosition: () => { },
        disposeAllSpatialAudioPlayers: () => { },
        createMetronome: silentMetronome
    };

    let current: AudioHost = silentHost;

    export function audio(): AudioHost {
        return current;
    }

    /** Overrides parts of the audio host; omitted members stay silent no-ops. */
    export function setAudioHost(host: Partial<AudioHost>) {
        current = { ...silentHost, ...host };
    }
}
