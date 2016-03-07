// Display/button/etc related stuff

namespace yelm.rt.minecraft {
    export class Board extends BaseBoard {
        id: string;

        private pendingCmds: {
            [index: string]: (v?: any) => void;
        }
        private ws: WebSocket;

        closeSocket() {
            console.log('socket closed...')
            this.ws = undefined;
            for (let cmd in this.pendingCmds)
                this.pendingCmds[cmd]([]);
            this.pendingCmds = {};
        }

        initSocketAsync() {
            if (this.ws) return Promise.resolve<WebSocket>(this.ws);
            this.ws = new WebSocket("ws://localhost:3000/client");
            return new Promise<WebSocket>((resolve, reject) => {
                this.ws.addEventListener('open', () => {
                    console.log('socket opened...')
                    resolve(this.ws);
                }, false);
                this.ws.addEventListener('message', ev => {
                    let parts = ev.data.split(' ');
                    let cb = this.pendingCmds[parts[0]];
                    if (cb) cb(parts.slice(1));
                }, false)
                this.ws.addEventListener('close', ev => this.closeSocket(), false);
                this.ws.addEventListener('error', ev => this.closeSocket(), false);
            })
        }

        private nextId: number = 0;
        queueCmd(cmd: string, args: string, cb: (v?: any) => void) {
            let id = `${this.id}-${this.nextId++}`;
            let slash = `${id} /${cmd} ${args}`;
            this.pendingCmds[id] = cb;

            this.initSocketAsync()
                .done(ws => {
                    if (ws) ws.send(slash);
                    else {
                        this.pendingCmds[id]([]);
                        delete this.pendingCmds[id];
                    }
                })
        }
    }

    function initBoard() {
        U.assert(!runtime.board)
        runtime.board = new Board()
    }

    export var target: Target = {
        name: "minecraft",
        initCurrentRuntime: initBoard
    }

    export function board() {
        return runtime.board as Board
    }


    export function panic(code: number) {
        console.log("PANIC:", code)
        throw new Error("PANIC " + code)
    }

    export function pause(ms: number) {
        let cb = getResume();
        setTimeout(() => { cb() }, ms)
    }

    export function runInBackground(a: RefAction) {
        runtime.runFiberAsync(a).done()
    }

    export function forever(a: RefAction) {
        function loop() {
            runtime.runFiberAsync(a)
                .then(() => Promise.delay(20))
                .then(loop)
                .done()
        }
        incr(a)
        loop()
    }

    export function postCommand(cmd: string, args: string): void {
        let cb = getResume();
        board().queueCmd(cmd, args, cb);

    }
}

