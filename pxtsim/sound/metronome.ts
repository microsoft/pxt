namespace pxsim.music {
    interface MetronomeMessage {
        type: "start" | "stop" | "set-interval";
        interval?: number;
    }

    export class Metronome {
        protected metronomeLoadPromise: Promise<Worker>;
        protected metronomeWorker: Worker;
        protected tickListeners: (() => void)[] = [];
        protected currentInterval: number;

        initAsync() {
            if (this.metronomeLoadPromise) return this.metronomeLoadPromise;
            if (this.metronomeWorker) return this.metronomeWorker;

            this.metronomeLoadPromise = new Promise(resolve => {
                this.metronomeWorker = new Worker("data:application/javascript," + encodeURIComponent(metronomeWorkerJS));

                const readyHandler = (ev: MessageEvent) => {
                    if (ev.data === "ready") {
                        resolve(this.metronomeWorker);
                        this.metronomeWorker.removeEventListener("message", readyHandler);
                        this.metronomeWorker.addEventListener("message", this.onTick)
                    }
                }

                this.metronomeWorker.addEventListener("message", readyHandler);
            })

            return this.metronomeLoadPromise;
        }

        stop() {
            this.postMessage({
                type: "stop"
            });
        }

        setInterval(interval: number) {
            this.currentInterval = interval;
            this.postMessage({
                type: "set-interval",
                interval
            });
        }

        start(interval: number) {
            this.currentInterval = interval;
            this.postMessage({
                type: "start",
                interval
            });
        }

        addTickListener(listener: () => void) {
            this.tickListeners.push(listener);
        }

        removeTickListener(listener: () => void) {
            this.tickListeners = this.tickListeners.filter(l => l !== listener)
        }

        interval() {
            return this.currentInterval;
        }

        dispose() {
            if (this.metronomeWorker) {
                this.metronomeWorker.terminate();
                this.metronomeWorker = undefined;
                this.metronomeLoadPromise = undefined;
                this.tickListeners = [];
                this.interval = undefined;
            }
            else if (this.metronomeLoadPromise) {
                this.metronomeLoadPromise.then(() => this.dispose());
                return;
            }
        }

        protected onTick = () => {
            for (const listener of this.tickListeners) {
                listener();
            }
        }

        protected postMessage(message: MetronomeMessage) {
            if (!this.metronomeWorker) {
                throw new Error("initAsync not called on metronome");
            }
            this.metronomeWorker.postMessage(message);
        }
    }

    const metronomeWorkerJS = `
/**
 * Adpated from https://github.com/cwilso/metronome/
 */

let timerRef;
let interval;

addEventListener("message", ev => {
    const message = ev.data;

    if (message.type === "start") {
        updateInterval(message.interval, true);
    }
    else if (message.type === "stop") {
        clearInterval(timerRef);
        timerRef = undefined;
    }
    else if (message.type === "set-interval") {
        updateInterval(message.interval, false);
    }
})

postMessage("ready");

function updateInterval(interval, startIfStopped) {
    if (timerRef) {
        clearInterval(timerRef);
        startIfStopped = true;
    }
    interval = interval;

    if (startIfStopped) {
        timerRef = setInterval(() => postMessage("tick"), interval);
    }
}
`;
}