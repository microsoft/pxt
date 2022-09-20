import { CancellationToken } from "../soundEffectEditor/SoundEffectEditor";

let metronomeWorker: Worker;
let metronomeLoadPromise: Promise<Worker>;
let playbackSong: pxt.assets.music.Song;
let currentPlaybackToken: CancellationToken;

const frequencies = [31, 33, 35, 37, 39, 41, 44, 46, 49, 52, 55, 58, 62, 65, 69, 73, 78, 82, 87, 92, 98, 104, 110, 117, 123, 131, 139, 147, 156, 165, 175, 185, 196, 208, 220, 233, 247, 262, 277, 294, 311, 330, 349, 370, 392, 415, 440, 466, 494, 523, 554, 587, 622, 659, 698, 740, 784, 831, 880, 932, 988, 1047, 1109, 1175, 1245, 1319, 1397, 1480, 1568, 1661, 1760, 1865, 1976, 2093, 2217, 2349, 2489, 2637, 2794, 2960, 3136, 3322, 3520, 3729, 3951, 4186, 4435, 4699, 4978, 5274, 5588, 5920, 6272, 6645, 7040, 7459, 7902, ]


export async function playNoteAsync(note: number, instrument: pxt.assets.music.Instrument, time: number, isCancelled?: () => boolean) {
    await pxsim.AudioContextManager.playInstructionsAsync(
        pxt.assets.music.renderInstrument(instrument, frequencies[note], time, 100),
        isCancelled
    )
}

async function loadMetronomeAsync() {
    if (metronomeLoadPromise) return metronomeLoadPromise;
    if (metronomeWorker) return metronomeWorker;

    metronomeLoadPromise = new Promise(resolve => {
        metronomeWorker = new Worker("/static/music-editor/metronomeWorker.js");

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
    let playbackToken: CancellationToken = {
        cancelled: false
    };
    if (currentPlaybackToken) currentPlaybackToken.cancelled = true;
    currentPlaybackToken = playbackToken;

    const metronome = await loadMetronomeAsync();
    playbackSong = song;

    let currentTick = 0;

    const isCancelled = () => playbackToken.cancelled;

    const tickToMs = (tick: number) => {
        return ((60000 / playbackSong.beatsPerMinute) / playbackSong.ticksPerBeat) * tick;
    }

    const postMessage = (message: MetronomeMessage) => {
        metronome.postMessage(message);
    }

    const onStop = () => {
        metronome.removeEventListener("message", onTick);
        postMessage({
            type: "stop"
        });
        playbackSong = undefined;
        playbackToken.cancelled = true;
    }

    const onTick = (ev: MessageEvent) => {
        if (ev.data !== "tick") return;

        if (isCancelled()) {
            onStop();
            return;
        }

        for (const track of playbackSong.tracks) {
            for (const noteEvent of track.notes) {
                if (noteEvent.startTick === currentTick) {
                    for (const note of noteEvent.notes) {
                        playNoteAsync(note, track.instrument, tickToMs(noteEvent.endTick - noteEvent.startTick), isCancelled);
                    }
                }
                else if (noteEvent.startTick > currentTick) {
                    break;
                }
            }
        }

        currentTick ++;

        if (currentTick >= song.ticksPerBeat * song.beatsPerMeasure * song.measures) {
            if (!loop) {
                onStop();
            }
            else {
                currentTick = 0;
            }
        }
    }

    postMessage({
        type: "start",
        interval: tickToMs(1)
    })
    metronome.addEventListener("message", onTick);
}

export function isPlaying() {
    return !!playbackSong;
}

export async function updatePlaybackSongAsync(song: pxt.assets.music.Song) {
    if (!isPlaying()) return;

    if (playbackSong.beatsPerMinute !== song.beatsPerMinute) {
        const metronome = await loadMetronomeAsync();
        metronome.postMessage({
            type: "set-interval",
            interval: (60000 / song.beatsPerMinute) / song.ticksPerBeat
        })
    }
    playbackSong = song;
}

export function stopPlayback() {
    if (currentPlaybackToken) {
        currentPlaybackToken.cancelled = true;
        currentPlaybackToken = undefined;
    }
}