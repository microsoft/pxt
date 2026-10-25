// Audio abstraction for the DOM-free core. The browser bundle registers a Web Audio
// implementation (see audiohostdom.ts); without one, audio calls are silent no-ops, except that
// playing instructions takes as long as the sound would, the metronome ticks on the host timers,
// stopAll runs the onStopAll listeners, and playing instructions and stopAll notify the sound
// event handler.
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
        removeTickListener(listener: () => void): void;
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

    /**
     * A sound event, named by its multiplayer wire string: "playinstructions" carries the
     * instruction buffer, "muteallchannels" carries none.
     */
    export type SoundEvent = "playinstructions" | "muteallchannels";

    let soundEventHandler: ((ev: SoundEvent, data?: Uint8Array) => void) | undefined;

    /** Sets the single sound event handler, replacing any previous one; undefined removes it. */
    export function setSoundEventHandler(handler: ((ev: SoundEvent, data?: Uint8Array) => void) | undefined) {
        soundEventHandler = handler;
    }

    /** Calls the sound event handler with ev and data when one is set; otherwise does nothing. */
    export function notifySoundEvent(ev: SoundEvent, data?: Uint8Array) {
        if (soundEventHandler)
            soundEventHandler(ev, data);
    }

    const CANCEL_POLL_MS = 16;

    /**
     * Notifies the sound event "playinstructions" with the buffer, then resolves once the buffer's
     * duration has elapsed on the host clock, or early once isCancelled returns true; isCancelled is
     * polled every frame-sized tick on the host timers.
     */
    function silentPlayInstructionsAsync(instructions: Uint8Array, isCancelled?: () => boolean): Promise<void> {
        notifySoundEvent("playinstructions", instructions);
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

    /**
     * A metronome that ticks on `host.timers()`: while running, it calls every tick listener, in the
     * order added, once per interval. It is running from `start` until `stop` or `dispose`.
     */
    export class TimerMetronome implements Metronome {
        protected tickListeners: (() => void)[] = [];
        /** The host interval id while running, else undefined. */
        protected timerId: host.TimerHandle | undefined;

        /** Resolves at once. */
        initAsync(): Promise<void> {
            return Promise.resolve();
        }

        /** Starts ticking every interval ms, the first tick interval ms from now; when already running, restarts the period from now. */
        start(interval: number) {
            this.updateInterval(interval, true);
        }

        /** Stops ticking; does nothing when not running. */
        stop() {
            if (this.timerId !== undefined) {
                host.timers().clearInterval(this.timerId);
                this.timerId = undefined;
            }
        }

        /** When running, restarts ticking every interval ms from now; when not running, does nothing. */
        setInterval(interval: number) {
            this.updateInterval(interval, false);
        }

        addTickListener(listener: () => void) {
            this.tickListeners.push(listener);
        }

        /** Removes every registration of listener. */
        removeTickListener(listener: () => void) {
            this.tickListeners = this.tickListeners.filter(l => l !== listener);
        }

        /** Stops ticking and removes every tick listener. */
        dispose() {
            this.stop();
            this.tickListeners = [];
        }

        /** Reschedules ticking every interval ms from now when running or when startIfStopped is true. */
        protected updateInterval(interval: number, startIfStopped: boolean) {
            if (this.timerId !== undefined) {
                host.timers().clearInterval(this.timerId);
                startIfStopped = true;
            }
            if (startIfStopped)
                this.timerId = host.timers().setInterval(this.onTick, interval);
        }

        protected onTick = () => {
            for (const listener of this.tickListeners)
                listener();
        };
    }

    /** The silent host's onStopAll listeners, in registration order. */
    const silentStopAllListeners: (() => void)[] = [];

    /** Notifies the sound event "muteallchannels", then calls every silent onStopAll listener in registration order. */
    function silentStopAll() {
        notifySoundEvent("muteallchannels");
        for (const listener of silentStopAllListeners)
            listener();
    }

    const silentHost: AudioHost = {
        tone: () => { },
        stop: () => { },
        setToneGain: () => { },
        onStopAll: handler => { silentStopAllListeners.push(handler); },
        isMuted: () => true,
        isAudioElementActive: () => false,
        sendMidiMessage: () => { },
        startSamplePlayback: () => ({ promise: Promise.resolve(), cancel: () => { } }),
        createAudioElement: () => undefined,
        stopAll: silentStopAll,
        mute: () => { },
        playInstructionsAsync: silentPlayInstructionsAsync,
        playPCMBufferStreamAsync: () => Promise.resolve(),
        setListenerPosition: () => { },
        disposeAllSpatialAudioPlayers: () => { },
        createMetronome: () => new TimerMetronome()
    };

    let current: AudioHost = silentHost;

    export function audio(): AudioHost {
        return current;
    }

    /** Overrides parts of the audio host; omitted members keep the silent defaults. */
    export function setAudioHost(host: Partial<AudioHost>) {
        current = { ...silentHost, ...host };
    }

    /** Incremented by the stopAll of every audio host queuePlayInstructions has run on. */
    let stopGeneration = 0;
    /** The audio host of the latest queuePlayInstructions call, else undefined. */
    let stopGenerationHost: AudioHost | undefined;

    /**
     * Calls audio().playInstructionsAsync(instructions) `when` milliseconds from now on host.timers(),
     * unless the stopAll of an audio host this function has run on runs in between. Registers an
     * onStopAll listener on audio() on the first call and on every call whose audio() differs from
     * the previous call's.
     */
    export function queuePlayInstructions(when: number, instructions: Uint8Array): void {
        const target = audio();
        if (stopGenerationHost !== target) {
            stopGenerationHost = target;
            target.onStopAll(() => stopGeneration++);
        }
        const queuedGeneration = stopGeneration;
        host.timers().setTimeout(() => {
            if (queuedGeneration === stopGeneration)
                audio().playInstructionsAsync(instructions);
        }, when);
    }
}
