/**
 * Adpated from https://github.com/cwilso/metronome/
 */

let timerRef: any;
let interval: number;

addEventListener("message", ev => {
    const message = ev.data as MetronomeMessage;

    if (ev.type === "start") {
        setInterval(message.interval, true);
    }
    else if (ev.type === "stop") {
        clearInterval(timerRef);
        timerRef = undefined;
    }
    else if (ev.type === "set-interval") {
        setInterval(message.interval, false);
    }
})

postMessage("ready");

function setInterval(interval: number, startIfStopped: boolean) {
    if (timerRef) {
        clearInterval(timerRef);
        startIfStopped = true;
    }
    interval = interval;

    if (startIfStopped) {
        timerRef = setInterval(() => postMessage("tick"));
    }
}