let sequencer: pxsim.music.Sequencer;
let playbackStateListeners: ((state: "play" | "loop" | "stop") => void)[] = [];
let onTickListeners: ((tick: number) => void)[] = [];

export async function startPlaybackAsync(song: pxt.assets.music.Song, loop: boolean, ticks?: number) {
    if (!sequencer) {
        sequencer = new pxsim.music.Sequencer();
        await sequencer.initAsync();

        sequencer.addEventListener("state-change", () => {
            for (const listener of playbackStateListeners) {
                listener(sequencer.state());
            }
        });

        sequencer.addEventListener("tick", () => {
            for (const listener of onTickListeners) {
                listener(sequencer.currentTick());
            }
        });
        sequencer.setVolume(100);
    }

    sequencer.startFrom(song, loop, ticks);
}

export function isPlaying() {
    return sequencer ? sequencer.state() !== "stop" : false;
}

export function isLooping() {
    return isPlaying() && sequencer.state() === "loop";
}

export function setLooping(loop: boolean) {
    if (sequencer) sequencer.setLooping(loop);
}

export async function updatePlaybackSongAsync(song: pxt.assets.music.Song) {
    if (sequencer) sequencer.updateSong(song);
}

export function stopPlayback() {
    if (sequencer) sequencer.stop();
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
