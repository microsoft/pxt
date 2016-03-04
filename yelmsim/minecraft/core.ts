// Display/button/etc related stuff

namespace yelm.rt.minecraft {
    export class Board extends BaseBoard {
        id: string;
    }
    
    function initBoard() {
        U.assert(!runtime.board)
        runtime.board = new Board()
    }
    
    export var target:Target = {
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

    export function serialSendString(s: string) {
        if (s.trim() && !quiet)
            console.log("SERIAL:", s)
    }
}

