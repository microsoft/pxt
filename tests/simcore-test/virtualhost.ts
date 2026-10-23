/** Clock members a pxsim.host.Clock needs. */
export interface VirtualClock {
    now(): number;
    perfNowUs(): number;
}

/** Timer members a pxsim.host.Timers needs. */
export interface VirtualTimers {
    setTimeout(fn: () => void, ms: number): number;
    clearTimeout(id: number): void;
    setInterval(fn: () => void, ms: number): number;
    clearInterval(id: number): void;
    requestFrame(fn: () => void): number;
    cancelFrame(id: number): void;
}

/** Members a pxsim.host.RandomSource needs. */
export interface VirtualRng {
    next(): number;
    seed(value: number): void;
}

/**
 * A deterministic simulator host for tests: a clock that only moves when the test advances it,
 * timers on a queue ordered by virtual time, and a seeded random source. Install it in a vm
 * context with `install`.
 */
export interface VirtualHost {
    clock: VirtualClock;
    timers: VirtualTimers;
    rng: VirtualRng;
    /** Virtual milliseconds elapsed since the host was created. */
    now(): number;
    /**
     * Moves virtual time forward by ms, firing every callback that falls due on the way in time
     * order and draining microtasks before and after each one.
     */
    advance(ms: number): Promise<void>;
    /**
     * Fires queued timeouts and frames in time order, moving virtual time to each, until none
     * remain. Intervals fire as their times come up but do not by themselves keep it running.
     */
    runUntilIdle(): Promise<void>;
    /** Installs the clock, timers and random source into the pxsim loaded in a vm context. */
    install(context: any): void;
}

/** One frame at 60 Hz, the delay requestFrame waits on the virtual queue. */
const FRAME_MS = 16;

/** What the clock reads at virtual time 0. Must be nonzero: the runtime treats a performance time of 0 as unset. */
const EPOCH_MS = 1000000;

interface Entry {
    id: number;
    at: number;
    /** Insertion order, breaking ties between entries due at the same time. */
    seq: number;
    fn: () => void;
    /** Set for intervals: the period to reschedule by after each firing. */
    period?: number;
}

/** A 32-bit mulberry32 generator returning numbers in [0, 1). */
function mulberry32(state: number) {
    return () => {
        state = (state + 0x6D2B79F5) | 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Resolves once every pending microtask has run. */
function drainMicrotasks(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
}

/** Creates a virtual host whose random source starts from seed. */
export function createVirtualHost(seed: number): VirtualHost {
    let time = 0;
    let nextId = 1;
    let nextSeq = 0;
    let queue: Entry[] = [];
    let draw = mulberry32(seed);

    const add = (fn: () => void, ms: number, period?: number) => {
        const entry: Entry = { id: nextId++, at: time + Math.max(0, ms || 0), seq: nextSeq++, fn, period };
        queue.push(entry);
        return entry.id;
    };
    const remove = (id: number) => {
        queue = queue.filter(e => e.id !== id);
    };
    const earliest = (filter: (e: Entry) => boolean) => {
        let best: Entry;
        for (const e of queue)
            if (filter(e) && (!best || e.at < best.at || e.at === best.at && e.seq < best.seq))
                best = e;
        return best;
    };
    const fire = (entry: Entry) => {
        time = Math.max(time, entry.at);
        if (entry.period !== undefined) {
            entry.at = time + Math.max(1, entry.period);
            entry.seq = nextSeq++;
        } else {
            remove(entry.id);
        }
        entry.fn();
    };

    const host: VirtualHost = {
        clock: {
            now: () => EPOCH_MS + time,
            perfNowUs: () => (EPOCH_MS + time) * 1000
        },
        timers: {
            setTimeout: (fn, ms) => add(fn, ms),
            clearTimeout: id => remove(id),
            setInterval: (fn, ms) => add(fn, ms, ms || 0),
            clearInterval: id => remove(id),
            requestFrame: fn => add(fn, FRAME_MS),
            cancelFrame: id => remove(id)
        },
        rng: {
            next: () => draw(),
            seed: value => { draw = mulberry32(value); }
        },
        now: () => time,
        advance: async (ms: number) => {
            const target = time + ms;
            await drainMicrotasks();
            for (let entry = earliest(e => e.at <= target); entry; entry = earliest(e => e.at <= target)) {
                fire(entry);
                await drainMicrotasks();
            }
            time = target;
        },
        runUntilIdle: async () => {
            await drainMicrotasks();
            while (queue.some(e => e.period === undefined)) {
                fire(earliest(() => true));
                await drainMicrotasks();
            }
        },
        install: (context: any) => {
            context.pxsim.host.setClock(host.clock);
            context.pxsim.host.setTimers(host.timers);
            context.pxsim.host.setRng(host.rng);
        }
    };
    return host;
}
