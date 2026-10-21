/**
 * Admits events on each key at most `limit` times within any `windowMs`
 * milliseconds. An event over the limit waits until the window allows it.
 * Callers that need admissions on one key in arrival order wait for each
 * admission before asking for the next.
 */
export class SlidingWindowAdmission {
    // per key: when each event admitted within the window was admitted
    protected admitted: pxt.Map<number[]> = {};

    /**
     * @param limit the most events on one key admitted within `windowMs`
     * @param windowMs the sliding window, in milliseconds
     * @param now returns the current time in milliseconds on a clock that never
     * goes back; defaults to `pxt.Util.monotonicNow`
     * @param delay returns a promise that resolves after the given number of milliseconds
     */
    constructor(
        readonly limit: number,
        readonly windowMs: number,
        protected readonly now: () => number = pxt.Util.monotonicNow,
        protected readonly delay: (ms: number) => Promise<void> = ms => pxt.Util.delay(ms)
    ) {
    }

    /**
     * Resolves once an event on `key` may happen under the limit, counting it
     * as admitted from then on.
     * @param check called before each attempt to admit the event; if it
     * throws, the returned promise rejects with its error and nothing is counted
     */
    async admitAsync(key: string, check?: () => void): Promise<void> {
        for (;;) {
            check?.();
            const now = this.now();
            const recent = (this.admitted[key] || []).filter(t => now - t < this.windowMs);
            this.admitted[key] = recent;
            if (recent.length < this.limit) {
                recent.push(now);
                return;
            }
            await this.delay(recent[0] + this.windowMs - now);
        }
    }
}
