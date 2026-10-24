// Audio abstraction for the DOM-free core. The browser bundle registers a Web Audio
// implementation (see audiohostdom.ts); without one, audio calls are silent no-ops, except that
// playing instructions takes as long as the sound would.
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

    export interface PlaySampleResult {
        promise: Promise<void>;
        cancel: () => void;
    }

    /** The subset of HTMLAudioElement used by targets for recorded-audio playback. */
    export interface AudioElementHandle {
        playbackRate: number;
        preservesPitch: boolean;
        currentTime: number;
        play(): Promise<void>;
        pause(): void;
        addEventListener(type: "play" | "ended", listener: () => void, options?: boolean): void;
        removeEventListener(type: "play" | "ended", listener: () => void): void;
    }

    export interface AudioHost {
        tone(frequency: number, gain: number): void;
        stop(): void;
        setToneGain(gain: number): void;
        onStopAll(handler: () => void): void;
        isMuted(): boolean;
        isAudioElementActive(): boolean;
        sendMidiMessage(buf: RefBuffer): void;
        startSamplePlayback(sample: RefBuffer, format: BufferMethods.NumberFormat, sampleRange: number, sampleRate: number, gain: number): PlaySampleResult;
        createAudioElement(uri: string, clippingThreshold: number, volume: number): AudioElementHandle;
        stopAll(): void;
        mute(mute: boolean): void;
        playInstructionsAsync(instructions: Uint8Array, isCancelled?: () => boolean, onPull?: SoundPreviewCallback): Promise<void>;
        playPCMBufferStreamAsync(pull: () => Float32Array, sampleRate: number, volume?: number, isCancelled?: () => boolean): Promise<void>;
        setListenerPosition(x: number, y: number, z: number): void;
        disposeAllSpatialAudioPlayers(): void;
        createMetronome(): Metronome;
    }

    const CANCEL_POLL_MS = 16;

    /**
     * Resolves once the buffer's duration has elapsed on the host clock, or early once isCancelled
     * returns true; isCancelled is polled every frame-sized tick on the host timers.
     */
    function silentPlayInstructionsAsync(instructions: Uint8Array, isCancelled?: () => boolean): Promise<void> {
        return new Promise<void>(resolve => {
            const deadline = host.clock().now() + music.instructionsDurationMs(instructions);
            const tick = () => {
                const remaining = deadline - host.clock().now();
                if (remaining <= 0 || (isCancelled && isCancelled()))
                    resolve();
                else
                    host.timers().setTimeout(tick, isCancelled ? Math.min(remaining, CANCEL_POLL_MS) : remaining);
            };
            tick();
        });
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
        tone: () => { },
        stop: () => { },
        setToneGain: () => { },
        onStopAll: () => { },
        isMuted: () => true,
        isAudioElementActive: () => false,
        sendMidiMessage: () => { },
        startSamplePlayback: () => ({ promise: Promise.resolve(), cancel: () => { } }),
        createAudioElement: () => undefined,
        stopAll: () => { },
        mute: () => { },
        playInstructionsAsync: silentPlayInstructionsAsync,
        playPCMBufferStreamAsync: () => Promise.resolve(),
        setListenerPosition: () => { },
        disposeAllSpatialAudioPlayers: () => { },
        createMetronome: silentMetronome
    };

    let current: AudioHost = silentHost;

    export function audio(): AudioHost {
        return current;
    }

    /** Overrides parts of the audio host; omitted members keep the silent defaults. */
    export function setAudioHost(host: Partial<AudioHost>) {
        current = { ...silentHost, ...host };
    }
}
