namespace pxsim {
    export interface AnimationOptions {
        interval: number;
        frame: () => boolean;
        whenDone?: (cancelled: boolean) => void;
        setTimeoutHandle?: host.TimerHandle;
    }

    export class AnimationQueue {
        private queue: AnimationOptions[] = [];
        private process: () => void;

        constructor(private runtime: Runtime) {
            this.process = () => {
                let top = this.queue[0];
                if (!top) return;
                if (this.runtime.dead) return;
                runtime = this.runtime;
                let res = top.frame();
                runtime.queueDisplayUpdate();
                runtime.maybeUpdateDisplay();
                if (res === false) {
                    this.queue.shift();
                    if (this.queue[0]) {
                        this.queue[0].setTimeoutHandle = host.timers().setTimeout(this.process, this.queue[0].interval);
                    }
                    top.whenDone(false);
                } else {
                    top.setTimeoutHandle = host.timers().setTimeout(this.process, top.interval);
                }
            }
        }

        public cancelAll() {
            let q = this.queue
            this.queue = []
            for (let a of q) {
                a.whenDone(true)
                if (a.setTimeoutHandle) {
                    host.timers().clearTimeout(a.setTimeoutHandle);
                }
            }
        }

        public cancelCurrent() {
            let top = this.queue[0]
            if (top) {
                this.queue.shift();
                top.whenDone(true);
                if (top.setTimeoutHandle) {
                    host.timers().clearTimeout(top.setTimeoutHandle);
                }
            }
        }

        public enqueue(anim: AnimationOptions) {
            if (!anim.whenDone) anim.whenDone = () => { };
            this.queue.push(anim)
            if (this.queue.length == 1)
                this.process()
        }

        public executeAsync(anim: AnimationOptions) {
            U.assert(!anim.whenDone)
            return new Promise<boolean>((resolve, reject) => {
                anim.whenDone = resolve
                this.enqueue(anim)
            })
        }
    }
}
