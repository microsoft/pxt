// Display/button/etc related stuff

namespace rt.micro_bit {
    export function panic(code: number) {
        console.log("PANIC:", code)
        throw new Error("PANIC " + code)
    }

    export function pause(ms: number) {
        let cb = getResume();
        setTimeout(() => { cb() }, ms)
    }

    export function scrollString(s: string) {
        let cb = getResume();
        console.log("SCROLL:", s)
        setTimeout(() => { cb() }, 100)
    }

    export function runInBackground(a: RefAction) {
        incr(a)
        setTimeout(() => {
            runtime.setupTop(() => { })
            action.run(a)
            decr(a) // if it's still running, action.run() has taken care of incrementing the counter
        }, 1)
    }

    export function serialSendString(s: string) {
        if (s.trim() && !quiet)
            console.log("SERIAL:", s)
    }

    export function showDigit(v: number) {
        if (!quiet)
            console.log("DIGIT:", v)
    }
}

