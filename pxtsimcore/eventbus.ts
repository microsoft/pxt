namespace pxsim {
    export type BoardPin = string;
    export interface BBLoc {
        type: "breadboard",
        row: string,
        col: string
        xOffset?: number,
        yOffset?: number,
        style?: PinStyle;
    };
    export interface BoardLoc {
        type: "dalboard",
        pin: BoardPin
    };
    export type Loc = BBLoc | BoardLoc;

    export function mkRange(a: number, b: number): number[] {
        let res: number[] = [];
        for (; a < b; a++)
            res.push(a);
        return res;
    }

    export class EventBus {
        private queues: Map<EventQueue> = {};
        private notifyID: number;
        private notifyOneID: number;
        private schedulerID: number;
        private idleEventID: number;
        private lastEventValue: string | number;
        private lastEventTimestampUs: number;
        private backgroundHandlerFlag: boolean = false;

        public nextNotifyEvent = 1024;

        constructor(
            private readonly runtime: Runtime,
            private readonly board: BaseBoard,
            private readonly valueToArgs?: EventValueToActionArgs
        ) {
            this.schedulerID = 15; // DEVICE_ID_SCHEDULER
            this.idleEventID = 2; // DEVICE_SCHEDULER_EVT_IDLE

            this.board.addMessageListener(this.handleMessage.bind(this));
        }

        private handleMessage(msg: pxsim.SimulatorMessage) {
            if (msg.type === "eventbus") {
                const ev = <SimulatorEventBusMessage>msg;
                this.queue(ev.id, ev.eventid, ev.value);
            }
        }

        public setBackgroundHandlerFlag() {
            this.backgroundHandlerFlag = true;
        }

        public setNotify(notifyID: number, notifyOneID: number) {
            this.notifyID = notifyID;
            this.notifyOneID = notifyOneID;
        }

        public setIdle(schedulerID: number, idleEventID: number) {
            this.schedulerID = schedulerID;
            this.idleEventID = idleEventID;
        }

        private start(id: EventIDType, evid: EventIDType, background: boolean, create: boolean = false) {
            let key = (background ? "back" : "fore") + ":" + id + ":" + evid
            if (!this.queues[key] && create) this.queues[key] = new EventQueue(this.runtime, this.valueToArgs);
            return this.queues[key];
        }

        listen(id: EventIDType, evid: EventIDType, handler: RefAction, flags = 0) {
            // special handle for idle, start the idle timeout
            if (id == this.schedulerID && evid == this.idleEventID)
                this.runtime.startIdle();

            let q = this.start(id, evid, this.backgroundHandlerFlag, true);
            if (this.backgroundHandlerFlag) {
                q.addHandler(handler, flags);
            }
            else {
                q.setHandler(handler, flags);
            }
            this.backgroundHandlerFlag = false;
        }

        removeBackgroundHandler(handler: RefAction) {
            Object.keys(this.queues).forEach((k: string) => {
                if (k.startsWith("back:"))
                    this.queues[k].removeHandler(handler)
            });
        }

        // this handles ANY (0) semantics for id and evid
        private getQueues(id: EventIDType, evid: EventIDType, bg: boolean) {
            let ret = [this.start(0, 0, bg)]
            if (id == 0 && evid == 0)
                return ret
            if (evid)
                ret.push(this.start(0, evid, bg))
            if (id)
                ret.push(this.start(id, 0, bg))
            if (id && evid)
                ret.push(this.start(id, evid, bg))
            return ret
        }

        queue(id: EventIDType, evid: EventIDType, value: EventIDType = null) {
            if (runtime.pausedOnBreakpoint) return;
            // special handling for notify one
            const notifyOne = this.notifyID && this.notifyOneID && id == this.notifyOneID;
            if (notifyOne)
                id = this.notifyID;
            let queues = this.getQueues(id, evid, true).concat(this.getQueues(id, evid, false))
            this.lastEventValue = evid;
            this.lastEventTimestampUs = U.perfNowUs();

            U.promiseMapAllSeries(queues, q => {
                if (q) return q.push(value, notifyOne);
                else return Promise.resolve()
            })
        }

        queueIdle() {
            if (this.schedulerID && this.idleEventID)
                this.queue(this.schedulerID, this.idleEventID);
        }

        // only for foreground handlers
        wait(id: number | string, evid: number | string, cb: (value?: any) => void) {
            let q = this.start(id, evid, false, true);
            q.addAwaiter(cb);
        }

        getLastEventValue() {
            return this.lastEventValue;
        }

        getLastEventTime() {
            return 0xffffffff & (this.lastEventTimestampUs - runtime.startTimeUs);
        }
    }
}
