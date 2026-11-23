namespace pxsim.host {
    /** The seed a virtual host's random source starts from when none is given. */
    export const DEFAULT_SEED = 0x5EED1234;

    export interface VirtualHostOptions {
        /** Seed for the random source. Defaults to DEFAULT_SEED. */
        seed?: number;
        /**
         * Waits for one turn of the event loop, so pending promises and any real timers that are
         * due get to run. Defaults to `setImmediate`, falling back to a `MessageChannel` message
         * and then `setTimeout(fn, 0)`.
         */
        yieldToEventLoop?: () => Promise<void>;
    }

    /**
     * A simulator host where time only moves when the caller advances it. Timers and frames wait
     * on a queue in virtual time, and random numbers come from a seed, so runs with the same seed
     * behave the same. Call `use` to install it, then drive it with `runUntil` and `advance`.
     */
    export interface VirtualHost {
        clock: Clock;
        timers: Timers;
        rng: RandomSource;
        /** Virtual milliseconds elapsed since the host was created. */
        now(): number;
        /**
         * Moves virtual time forward by `ms`, firing each callback that comes due, in time order.
         * The event loop gets a turn before and after each callback.
         */
        advance(ms: number): Promise<void>;
        /**
         * Fires queued callbacks, intervals included, one at a time in time order until `done`
         * returns true. Virtual time jumps to each callback, and the event loop gets a turn before
         * and after each one. When the queue is empty it keeps yielding, so real timers can still
         * make `done` true.
         */
        runUntil(done: () => boolean): Promise<void>;
        /**
         * Stops the host for good. An `advance` or `runUntil` in progress returns at its next step
         * without firing anything else, and later calls return right away.
         */
        stop(): void;
        /** Makes this host's clock, timers and random source the ones the runtime reads. */
        use(): void;
    }

    /**
     * What the clock reads at virtual time 0. It must not be 0, because the runtime treats a
     * performance time of 0 as unset.
     */
    const EPOCH_MS = 1000000;

    interface Entry {
        id: number;
        at: number;
        /** Insertion order, breaking ties between entries due at the same time. */
        seq: number;
        fn: () => void;
        /** For intervals, how long to wait before firing again. */
        period?: number;
    }

    function defaultYieldToEventLoop(): () => Promise<void> {
        if (typeof setImmediate !== "undefined")
            return () => new Promise<void>(resolve => setImmediate(resolve));
        if (typeof MessageChannel !== "undefined")
            return () => new Promise<void>(resolve => {
                const channel = new MessageChannel();
                channel.port1.onmessage = () => {
                    channel.port1.close();
                    resolve();
                };
                channel.port2.postMessage(undefined);
            });
        return () => new Promise<void>(resolve => setTimeout(resolve, 0));
    }

    /** Creates a virtual host at virtual time 0. The runtime does not read it until `use` is called. */
    export function createVirtualHost(options: VirtualHostOptions = {}): VirtualHost {
        const yieldToEventLoop = options.yieldToEventLoop || defaultYieldToEventLoop();
        let time = 0;
        let stopped = false;
        let nextId = 1;
        let nextSeq = 0;
        let queue: Entry[] = [];

        const add = (fn: () => void, ms: number, period?: number) => {
            const entry: Entry = { id: nextId++, at: time + Math.max(0, ms || 0), seq: nextSeq++, fn, period };
            queue.push(entry);
            return entry.id;
        };
        const remove = (id: host.TimerHandle) => {
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

        const virtualHost: VirtualHost = {
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
            rng: createSeededRandom(options.seed === undefined ? DEFAULT_SEED : options.seed),
            now: () => time,
            advance: async (ms: number) => {
                const target = time + ms;
                await yieldToEventLoop();
                for (let entry = earliest(e => e.at <= target); !stopped && entry; entry = earliest(e => e.at <= target)) {
                    fire(entry);
                    await yieldToEventLoop();
                }
                if (!stopped)
                    time = target;
            },
            runUntil: async (done: () => boolean) => {
                await yieldToEventLoop();
                while (!stopped && !done()) {
                    const entry = earliest(() => true);
                    if (entry)
                        fire(entry);
                    await yieldToEventLoop();
                }
            },
            stop: () => { stopped = true; },
            use: () => {
                setClock(virtualHost.clock);
                setTimers(virtualHost.timers);
                setRng(virtualHost.rng);
            }
        };
        return virtualHost;
    }
}
