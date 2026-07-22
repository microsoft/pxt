let sequencer: pxsim.music.Sequencer;
let playbackStateListeners: ((state: "play" | "loop" | "stop") => void)[] = [];
let onTickListeners: ((tick: number) => void)[] = [];
let playbackSong: pxt.assets.music.Song;
let noteTracker: NoteTracker;

export async function startPlaybackAsync(song: pxt.assets.music.Song, loop: boolean, ticks?: number) {
    playbackSong = song;
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
    playbackSong = song;
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

export function addNoteChangeListener(listener: (track: number, note: number, on: boolean) => void) {
    if (!noteTracker) noteTracker = new NoteTracker();
    noteTracker.addNoteChangeListener(listener);
}

export function removeNoteChangeListener(listener: (track: number, note: number, on: boolean) => void) {
    if (noteTracker) noteTracker.removeNoteChangeListener(listener);
}


export class NoteTracker {
    private activeNotes: { [track: number]: number[] } = {};
    private noteChangeListeners: ((track: number, note: number, on: boolean) => void)[] = [];

    constructor() {
        addTickListener(this.onTick);
        addPlaybackStateListener(this.onPlaybackStateChange);
    }

    protected onTick = (tick: number) => {
        const newActiveNotes: { [track: number]: number[] } = {};
        for (let i = 0; i < playbackSong.tracks.length; i++) {
            newActiveNotes[i] = [];

            const track = playbackSong.tracks[i];

            for (const event of track.notes) {
                if (event.startTick > tick) break;

                if (event.startTick <= tick && event.endTick > tick) {
                    for (const note of event.notes) {
                        newActiveNotes[i].push(note.note);
                    }
                }
            }
        }

        for (let i = 0; i < playbackSong.tracks.length; i++) {
            const oldNotes = this.activeNotes[i] || [];
            const newNotes = newActiveNotes[i] || [];

            for (const note of oldNotes) {
                if (!newNotes.includes(note)) {
                    for (const listener of this.noteChangeListeners) {
                        listener(i, note, false);
                    }
                }
            }

            for (const note of newNotes) {
                if (!oldNotes.includes(note)) {
                    for (const listener of this.noteChangeListeners) {
                        listener(i, note, true);
                    }
                }
            }
        }

        this.activeNotes = newActiveNotes;
    }

    protected onPlaybackStateChange = (state: "play" | "stop" | "loop") => {
        if (state === "stop") {
            for (const track in this.activeNotes) {
                for (const note of this.activeNotes[track]) {
                    for (const listener of this.noteChangeListeners) {
                        listener(parseInt(track), note, false);
                    }
                }
            }

            this.activeNotes = {};
        }
    }

    addNoteChangeListener(listener: (track: number, note: number, on: boolean) => void) {
        this.noteChangeListeners.push(listener);
    }

    removeNoteChangeListener(listener: (track: number, note: number, on: boolean) => void) {
        this.noteChangeListeners = this.noteChangeListeners.filter(l => listener !== l);
    }

    dispose() {
        removeTickListener(this.onTick);
        removePlaybackStateListener(this.onPlaybackStateChange);
    }

    getActiveNotes(track: number) {
        return this.activeNotes[track] || [];
    }
}