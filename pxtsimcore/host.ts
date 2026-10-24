// Host abstraction: everything the DOM-free simulator core needs to know about the
// environment it runs in. The DOM bundle installs a browser implementation
// (see domhost.ts); without one the core runs with inert defaults.
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

    /** Overrides parts of the environment; omitted members keep their defaults. */
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

    /** The timer source the runtime schedules work on. Ids are opaque and only valid for the matching clear call. */
    export interface Timers {
        setTimeout(fn: () => void, ms: number): any;
        clearTimeout(id: any): void;
        setInterval(fn: () => void, ms: number): any;
        clearInterval(id: any): void;
        /** Runs fn before the next display frame. */
        requestFrame(fn: () => void): any;
        cancelFrame(id: any): void;
    }

    /** The random number source behind program randomness. */
    export interface RandomSource {
        /** Returns the next number in [0, 1). */
        next(): number;
        /** Seeds the generator; a source that cannot be seeded ignores it. */
        seed(value: number): void;
    }

    /**
     * Creates a deterministic random source: a 32-bit mulberry32 generator returning numbers in
     * [0, 1), starting from seed. `seed(value)` restarts the sequence from value, so one seed always
     * yields the same sequence.
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

    let perf: () => number;

    const defaultClock: Clock = {
        now: () => Date.now(),
        perfNowUs: () => {
            if (!perf)
                perf = typeof performance != "undefined" ?
                    performance.now.bind(performance) ||
                    (performance as any).moznow.bind(performance) ||
                    (performance as any).msNow.bind(performance) ||
                    (performance as any).webkitNow.bind(performance) ||
                    (performance as any).oNow.bind(performance) :
                    Date.now;
            return perf() * 1000;
        }
    };

    const FRAME_MS = 16;

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

    /** Overrides parts of the clock; omitted members keep their defaults. */
    export function setClock(c: Partial<Clock>) {
        currentClock = { ...defaultClock, ...c };
    }

    export function timers(): Timers {
        return currentTimers;
    }

    /** Overrides parts of the timers; omitted members keep their defaults. */
    export function setTimers(t: Partial<Timers>) {
        currentTimers = { ...defaultTimers, ...t };
    }

    export function rng(): RandomSource {
        return currentRng;
    }

    /** Overrides parts of the random source; omitted members keep their defaults. */
    export function setRng(r: Partial<RandomSource>) {
        currentRng = { ...defaultRng, ...r };
    }
}
