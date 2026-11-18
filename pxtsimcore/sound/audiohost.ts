// The audio host is how the DOM-free core plays sound. The browser bundle registers a Web Audio
// implementation (see audiohostdom.ts). Without one, the core uses a silent host. It makes no sound,
// but playing instructions still takes as long as the sound would, and the metronome still ticks.
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
        /** Resolves once the metronome is ready to start. Ignore the value it resolves with. */
        initAsync(): Promise<unknown>;
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
     * A sound event, named by the string multiplayer sends for it. "playinstructions" comes with
     * the instruction buffer, and "muteallchannels" has no data.
     */
    export type SoundEvent = "playinstructions" | "muteallchannels";

    let soundEventHandler: ((ev: SoundEvent, data?: Uint8Array) => void) | undefined;

    export function setSoundEventHandler(handler: ((ev: SoundEvent, data?: Uint8Array) => void) | undefined) {
        soundEventHandler = handler;
    }

    export function notifySoundEvent(ev: SoundEvent, data?: Uint8Array) {
        if (soundEventHandler)
            soundEventHandler(ev, data);
    }

    const CANCEL_POLL_MS = 16;

    /**
     * Plays instructions on the silent host. Sends the "playinstructions" sound event, then
     * resolves after the sound's duration on the host clock. If `isCancelled` is given, it is
     * checked about once a frame and ends the wait early.
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
     * A metronome driven by `host.timers()`. While running, it calls each tick listener once per
     * interval, in the order they were added. The silent audio host uses it.
     */
    export class TimerMetronome implements Metronome {
        protected tickListeners: (() => void)[] = [];
        protected timerId: host.TimerHandle | undefined;

        initAsync(): Promise<void> {
            return Promise.resolve();
        }

        /**
         * Starts ticking every `interval` ms, with the first tick one interval from now. If it is
         * already running, the timing restarts from now.
         */
        start(interval: number) {
            this.updateInterval(interval, true);
        }

        stop() {
            if (this.timerId !== undefined) {
                host.timers().clearInterval(this.timerId);
                this.timerId = undefined;
            }
        }

        setInterval(interval: number) {
            this.updateInterval(interval, false);
        }

        addTickListener(listener: () => void) {
            this.tickListeners.push(listener);
        }

        removeTickListener(listener: () => void) {
            this.tickListeners = this.tickListeners.filter(l => l !== listener);
        }

        dispose() {
            this.stop();
            this.tickListeners = [];
        }

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

    const silentStopAllListeners: (() => void)[] = [];

    function silentStopAll() {
        notifySoundEvent("muteallchannels");
        for (const listener of silentStopAllListeners)
            listener();
    }

    function silentCreateAudioElement(): AudioElementHandle {
        return {
            playbackRate: 1,
            preservesPitch: true,
            currentTime: 0,
            play: () => Promise.resolve(),
            pause: () => { },
            addEventListener: () => { },
            removeEventListener: () => { }
        };
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
        createAudioElement: silentCreateAudioElement,
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

    /** Overrides parts of the audio host. Anything left out goes back to the silent host. */
    export function setAudioHost(overrides: Partial<AudioHost>) {
        current = { ...silentHost, ...overrides };
    }

    let stopGeneration = 0;
    let stopGenerationHost: AudioHost | undefined;

    /**
     * Calls `play` in `when` milliseconds, unless stopAll runs first. This lets stopAll cancel
     * sounds that are scheduled but have not started yet. It hooks onStopAll on the current audio
     * host whenever that host changes.
     */
    export function queuePlay(when: number, play: () => void): void {
        const target = audio();
        if (stopGenerationHost !== target) {
            stopGenerationHost = target;
            target.onStopAll(() => stopGeneration++);
        }
        const queuedGeneration = stopGeneration;
        host.timers().setTimeout(() => {
            if (queuedGeneration === stopGeneration)
                play();
        }, when);
    }

    export function queuePlayInstructions(when: number, instructions: Uint8Array): void {
        queuePlay(when, () => audio().playInstructionsAsync(instructions));
    }
}
