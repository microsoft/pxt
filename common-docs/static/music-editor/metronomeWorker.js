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