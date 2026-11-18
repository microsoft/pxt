// The host is what the DOM-free simulator core needs from the place it runs: a way to message the
// editor, a few facts about the page, a clock, timers and random numbers. Each part has a default
// that works without a browser. In the browser, domhost.ts installs an environment that posts to
// the parent window.
namespace pxsim.host {
    export interface Environment {
        /** Delivers a message to the parent (editor) window, if any. */
        postToParent(data: SimulatorMessage): void;
        /** The current page URL, or undefined when there is no page. */
        locationHref(): string | undefined;
        isPxtElectron(): boolean;
        isIpcRenderer(): boolean;
        /** Id of the simulator frame hosting this runtime, if any. */
        frameId(): string | undefined;
    }

    const defaultEnvironment: Environment = {
        postToParent: () => { },
        locationHref: () => undefined,
        isPxtElectron: () => false,
        isIpcRenderer: () => false,
        frameId: () => undefined
    };

    let current: Environment = defaultEnvironment;

    export function environment(): Environment {
        return current;
    }

    /** Overrides parts of the environment. Anything left out goes back to its default. */
    export function setEnvironment(env: Partial<Environment>) {
        current = { ...defaultEnvironment, ...env };
    }

    /** The time source the runtime reads. */
    export interface Clock {
        /** Current time in milliseconds since an arbitrary epoch. */
        now(): number;
        /** Current time in microseconds, from the highest-resolution source available. */
        perfNowUs(): number;
    }

    /** A pending timer or frame request. Pass it to the matching clear or cancel call. */
    export type TimerHandle = unknown;

    /** The timer source the runtime schedules work on. */
    export interface Timers {
        setTimeout(fn: () => void, ms: number): TimerHandle;
        clearTimeout(id: TimerHandle): void;
        setInterval(fn: () => void, ms: number): TimerHandle;
        clearInterval(id: TimerHandle): void;
        /** Runs fn before the next display frame. */
        requestFrame(fn: () => void): TimerHandle;
        cancelFrame(id: TimerHandle): void;
    }

    /** The random number source behind program randomness. */
    export interface RandomSource {
        /** Returns the next number in [0, 1). */
        next(): number;
        /** Seeds the generator. A source that cannot be seeded ignores this. */
        seed(value: number): void;
    }

    /**
     * Creates a random source that always gives the same sequence for the same seed. It uses the
     * mulberry32 generator. Calling `seed` restarts the sequence from the new value.
     */
    export function createSeededRandom(seed: number): RandomSource {
        let state = seed;
        return {
            next: () => {
                state = (state + 0x6D2B79F5) | 0;
                let t = state;
                t = Math.imul(t ^ (t >>> 15), t | 1);
                t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            },
            seed: value => { state = value; }
        };
    }

    /**
     * Returns performance.now, or a vendor-prefixed version of it. Falls back to Date.now when
     * there is none.
     */
    function highResolutionNow(): () => number {
        if (typeof performance == "undefined")
            return Date.now;
        const p = performance as any;
        const now: () => number = p.now || p.mozNow || p.msNow || p.webkitNow || p.oNow;
        return now ? now.bind(performance) : Date.now;
    }

    let perf: () => number;

    const defaultClock: Clock = {
        now: () => Date.now(),
        perfNowUs: () => {
            if (!perf)
                perf = highResolutionNow();
            return perf() * 1000;
        }
    };

    /**
     * One frame at about 60 Hz, in milliseconds. requestFrame waits this long when there is no
     * display frame to wait for.
     */
    export const FRAME_MS = 16;

    const defaultTimers: Timers = {
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: id => clearTimeout(id),
        setInterval: (fn, ms) => setInterval(fn, ms),
        clearInterval: id => clearInterval(id),
        requestFrame: fn => typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame(fn) : setTimeout(fn, FRAME_MS),
        cancelFrame: id => typeof cancelAnimationFrame !== "undefined" ? cancelAnimationFrame(id) : clearTimeout(id)
    };

    const defaultRng: RandomSource = {
        next: () => Math.random(),
        seed: () => { }
    };

    let currentClock: Clock = defaultClock;
    let currentTimers: Timers = defaultTimers;
    let currentRng: RandomSource = defaultRng;

    export function clock(): Clock {
        return currentClock;
    }

    /** Overrides parts of the clock. Anything left out goes back to its default. */
    export function setClock(c: Partial<Clock>) {
        currentClock = { ...defaultClock, ...c };
    }

    export function timers(): Timers {
        return currentTimers;
    }

    /** Overrides parts of the timers. Anything left out goes back to its default. */
    export function setTimers(t: Partial<Timers>) {
        currentTimers = { ...defaultTimers, ...t };
    }

    export function rng(): RandomSource {
        return currentRng;
    }

    /** Overrides parts of the random source. Anything left out goes back to its default. */
    export function setRng(r: Partial<RandomSource>) {
        currentRng = { ...defaultRng, ...r };
    }
}
