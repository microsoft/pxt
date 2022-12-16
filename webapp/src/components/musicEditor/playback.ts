import { CancellationToken } from "../soundEffectEditor/SoundEffectEditor";

let metronomeWorker: Worker;
let metronomeLoadPromise: Promise<Worker>;

let currentPlaybackState: PlaybackState;

interface PlaybackState {
    song: pxt.assets.music.Song;
    tick: number;
    cancellationToken: CancellationToken;
    looping: boolean;
}

let playbackStopListeners: (() => void)[] = [];
let onTickListeners: ((tick: number) => void)[] = [];


const frequencies = [31, 33, 35, 37, 39, 41, 44, 46, 49, 52, 55, 58, 62, 65, 69, 73,
    78, 82, 87, 92, 98, 104, 110, 117, 123, 131, 139, 147, 156, 165, 175, 185, 196, 208,
    220, 233, 247, 262, 277, 294, 311, 330, 349, 370, 392, 415, 440, 466, 494, 523, 554,
    587, 622, 659, 698, 740, 784, 831, 880, 932, 988, 1047, 1109, 1175, 1245, 1319, 1397,
    1480, 1568, 1661, 1760, 1865, 1976, 2093, 2217, 2349, 2489, 2637, 2794, 2960, 3136,
    3322, 3520, 3729, 3951, 4186, 4435, 4699, 4978, 5274, 5588, 5920, 6272, 6645, 7040,
    7459, 7902];


export async function playNoteAsync(note: number, instrument: pxt.assets.music.Instrument, time: number, isCancelled?: () => boolean) {
    await pxsim.AudioContextManager.playInstructionsAsync(
        pxt.assets.music.renderInstrument(instrument, frequencies[note], time, 100),
        isCancelled
    )
}

export async function playDrumAsync(drum: pxt.assets.music.DrumInstrument, isCancelled?: () => boolean) {
    await pxsim.AudioContextManager.playInstructionsAsync(
        pxt.assets.music.renderDrumInstrument(drum, 100),
        isCancelled
    )
}

async function loadMetronomeAsync() {
    if (metronomeLoadPromise) return metronomeLoadPromise;
    if (metronomeWorker) return metronomeWorker;

    metronomeLoadPromise = new Promise(resolve => {
        metronomeWorker = new Worker("data:application/javascript," + encodeURIComponent(workerJS));

        const readyHandler = (ev: MessageEvent) => {
            if (ev.data === "ready") {
                resolve(metronomeWorker);
                metronomeWorker.removeEventListener("message", readyHandler);
            }
        }

        metronomeWorker.addEventListener("message", readyHandler);
    })

    return metronomeLoadPromise;
}

export async function startPlaybackAsync(song: pxt.assets.music.Song, loop: boolean) {
    const playbackState: PlaybackState = {
        song,
        looping: loop,
        cancellationToken: {
            cancelled: false
        },
        tick: 0
    }

    if (currentPlaybackState) currentPlaybackState.cancellationToken.cancelled = true;
    currentPlaybackState = playbackState;

    const metronome = await loadMetronomeAsync();

    let currentTick = 0;

    const isCancelled = () => playbackState.cancellationToken.cancelled;

    const postMessage = (message: MetronomeMessage) => {
        metronome.postMessage(message);
    }

    const onStop = () => {
        metronome.removeEventListener("message", onTick);
        playbackState.cancellationToken.cancelled = true;

        if (!isPlaying()) {
            postMessage({
                type: "stop"
            });

            for (const listener of playbackStopListeners) {
                listener();
            }
        }
    }

    const onTick = (ev: MessageEvent) => {
        if (ev.data !== "tick") return;

        if (isCancelled()) {
            onStop();
            return;
        }

        for (const track of playbackState.song.tracks) {
            for (const noteEvent of track.notes) {
                if (noteEvent.startTick === currentTick) {
                    for (const note of noteEvent.notes) {
                        if (track.drums) {
                            playDrumAsync(track.drums[note], isCancelled);
                        }
                        else {
                            playNoteAsync(note, track.instrument, tickToMs(playbackState.song.beatsPerMinute, playbackState.song.ticksPerBeat, noteEvent.endTick - noteEvent.startTick), isCancelled);
                        }
                    }
                }
                else if (noteEvent.startTick > currentTick) {
                    break;
                }
            }
        }

        for (const listener of onTickListeners) {
            listener(currentTick);
        }

        currentTick ++;

        if (currentTick >= playbackState.song.ticksPerBeat * playbackState.song.beatsPerMeasure * playbackState.song.measures) {
            if (!playbackState.looping) {
                onStop();
            }
            else {
                currentTick = 0;
            }
        }
    }

    postMessage({
        type: "start",
        interval: tickToMs(playbackState.song.beatsPerMinute, playbackState.song.ticksPerBeat, 1)
    })
    metronome.addEventListener("message", onTick);
}

export function tickToMs(beatsPerMinute: number, ticksPerBeat: number, ticks: number) {
    return ((60000 / beatsPerMinute) / ticksPerBeat) * ticks;
}

export function isPlaying() {
    return currentPlaybackState ? !currentPlaybackState.cancellationToken.cancelled : false;
}

export function isLooping() {
    return isPlaying() && currentPlaybackState.looping;
}

export function setLooping(loop: boolean) {
    if (currentPlaybackState) currentPlaybackState.looping = loop;
}

export async function updatePlaybackSongAsync(song: pxt.assets.music.Song) {
    if (!isPlaying()) return;

    if (currentPlaybackState.song.beatsPerMinute !== song.beatsPerMinute) {
        const metronome = await loadMetronomeAsync();
        metronome.postMessage({
            type: "set-interval",
            interval: tickToMs(song.beatsPerMinute, song.ticksPerBeat, 1)
        })
    }
    currentPlaybackState.song = song;
}

export function stopPlayback() {
    if (currentPlaybackState) currentPlaybackState.cancellationToken.cancelled = true;
}

export function addTickListener(listener: (tick: number) => void) {
    onTickListeners.push(listener);
}

export function removeTickListener(listener: (tick: number) => void) {
    onTickListeners = onTickListeners.filter(l => listener !== l);
}

export function addPlaybackStopListener(listener: () => void) {
    playbackStopListeners.push(listener);
}

export function removePlaybackStopListener(listener: () => void) {
    playbackStopListeners = playbackStopListeners.filter(l => listener !== l);
}

const workerJS = `
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