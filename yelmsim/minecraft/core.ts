// Display/button/etc related stuff

namespace yelm.rt.minecraft {
    export class Board extends BaseBoard {
        id: string;

        private pendingCmds: {
            [index: string]: (v?: any) => void;
        }
        private ws: WebSocket;
        public element: HTMLDivElement;
        
        constructor() {
            super();
            
            this.element = document.createElement("div") as HTMLDivElement;
            this.element.className = 'sim-log';
        }
               
        closeSocket() {
            console.log('socket closed...')
            this.ws = undefined;
            for (let cmd in this.pendingCmds)
                this.pendingCmds[cmd]([]);
            this.pendingCmds = undefined;
        }

        initSocketAsync() {
            if (this.ws) return Promise.resolve<WebSocket>(this.ws);
            
            this.ws = new WebSocket("ws://127.0.0.1:3000/client");
            this.pendingCmds = {};
            
            return new Promise<WebSocket>((resolve, reject) => {
                this.ws.addEventListener('open', () => {
                    console.log('socket opened...')
                    resolve(this.ws);
                }, false);
                this.ws.addEventListener('message', ev => {
                    let parts = ev.data.split(':');
                    let cb = this.pendingCmds[parts[0]];
                    if (cb) cb(parts.slice(1));
                }, false)
                this.ws.addEventListener('close', ev => this.closeSocket(), false);
                this.ws.addEventListener('error', ev => this.closeSocket(), false);
            })
        }

        private nextId: number = 0;
        queueCmd(cmd: string, args: string, cb: (v?: any) => void) {
            let id = `${runtime.id}-${this.nextId++}`;
            let slash = `/${cmd} ${args}`;
            let slashws = `/${cmd} ${id} ${args}`;
            
            this.appendChat(slash);
            
            this.initSocketAsync()
                .done(ws => {
                    if (ws) {
                        this.pendingCmds[id] = cb;
                        ws.send(slashws);
                    } else {
                        cb([]);
                    }
                })
        }
        
        private appendChat(txt : string) {
            let msg = document.createElement('div') as HTMLDivElement;
            msg.innerText = txt;
            while(this.element.childElementCount > 10) this.element.removeChild(this.element.firstElementChild);            
            this.element.appendChild(msg);
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

