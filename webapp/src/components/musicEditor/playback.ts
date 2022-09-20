let metronomeWorker: Worker;
let metronomeLoadPromise: Promise<Worker>;

const frequencies = [31, 33, 35, 37, 39, 41, 44, 46, 49, 52, 55, 58, 62, 65, 69, 73, 78, 82, 87, 92, 98, 104, 110, 117, 123, 131, 139, 147, 156, 165, 175, 185, 196, 208, 220, 233, 247, 262, 277, 294, 311, 330, 349, 370, 392, 415, 440, 466, 494, 523, 554, 587, 622, 659, 698, 740, 784, 831, 880, 932, 988, 1047, 1109, 1175, 1245, 1319, 1397, 1480, 1568, 1661, 1760, 1865, 1976, 2093, 2217, 2349, 2489, 2637, 2794, 2960, 3136, 3322, 3520, 3729, 3951, 4186, 4435, 4699, 4978, 5274, 5588, 5920, 6272, 6645, 7040, 7459, 7902, ]


export async function playNoteAsync(note: number, instrument: pxt.assets.music.Instrument, time: number) {
    await pxsim.AudioContextManager.playInstructionsAsync(
        pxt.assets.music.renderInstrument(instrument, frequencies[note], time, 100)
    )
}

async function loadMetronomeAsync() {
    if (metronomeLoadPromise) return metronomeLoadPromise;
    if (metronomeWorker) return metronomeWorker;

    metronomeLoadPromise = new Promise(resolve => {
        metronomeWorker = new Worker();

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