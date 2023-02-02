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

let playbackStateListeners: ((state: "play" | "loop" | "stop") => void)[] = [];
let onTickListeners: ((tick: number) => void)[] = [];


const frequencies = [31, 33, 35, 37, 39, 41, 44, 46, 49, 52, 55, 58, 62, 65, 69, 73,
    78, 82, 87, 92, 98, 104, 110, 117, 123, 131, 139, 147, 156, 165, 175, 185, 196, 208,
    220, 233, 247, 262, 277, 294, 311, 330, 349, 370, 392, 415, 440, 466, 494, 523, 554,
    587, 622, 659, 698, 740, 784, 831, 880, 932, 988, 1047, 1109, 1175, 1245, 1319, 1397,
    1480, 1568, 1661, 1760, 1865, 1976, 2093, 2217, 2349, 2489, 2637, 2794, 2960, 3136,
    3322, 3520, 3729, 3951, 4186, 4435, 4699, 4978, 5274, 5588, 5920, 6272, 6645, 7040,
    7459, 7902];

const notes = {

"C": 262,
"CSharp": 277,
"D": 294,
"Eb": 311,
"E": 330,
"F": 349,
"FSharp": 370,
"G": 392,
"GSharp": 415,
"A": 440,
"Bb": 466,
"B": 494,
"C3": 131,
"CSharp3": 139,
"D3": 147,
"Eb3": 156,
"E3": 165,
"F3": 175,
"FSharp3": 185,
"G3": 196,
"GSharp3": 208,
"A3": 220,
"Bb3": 233,
"B3": 247,
"C4": 262,
"CSharp4": 277,
"D4": 294,
"Eb4": 311,
"E4": 330,
"F4": 349,
"FSharp4": 370,
"G4": 392,
"GSharp4": 415,
"A4": 440,
"Bb4": 466,
"B4": 494,
"C5": 523,
"CSharp5": 555,
"D5": 587,
"Eb5": 622,
"E5": 659,
"F5": 698,
"FSharp5": 740,
"G5": 784,
"GSharp5": 831,
"A5": 880,
"Bb5": 932,
"B5": 988,
"C6": 1047,
"CSharp6": 1109,
"D6": 1175,
"Eb6": 1245,
"E6": 1319,
"F6": 1397,
"FSharp6": 1480,
"G6": 1568,
"GSharp6": 1568,
"A6": 1760,
"Bb6": 1865,
"B6": 1976,
"C7": 2093

}


export function noteName(note: number) {
    const freq = frequencies[note];

    for (const key of Object.keys(notes)) {
        if (Math.abs((notes as any)[key] - freq) < 5) return key;
    }
    return "UNKNOWN"
}

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

            for (const listener of playbackStateListeners) {
                listener("stop");
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
                            playDrumAsync(track.drums[note.note], isCancelled);
                        }
                        else {
                            playNoteAsync(note.note, track.instrument, tickToMs(playbackState.song.beatsPerMinute, playbackState.song.ticksPerBeat, noteEvent.endTick - noteEvent.startTick), isCancelled);
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

    for (const listener of playbackStateListeners) {
        listener(loop ? "loop" : "play");
    }
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

export function addPlaybackStateListener(listener: (state: "play" | "stop" | "loop") => void) {
    playbackStateListeners.push(listener);
}

export function removePlaybackStateListener(listener: (state: "play" | "stop" | "loop") => void) {
    playbackStateListeners = playbackStateListeners.filter(l => listener !== l);
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