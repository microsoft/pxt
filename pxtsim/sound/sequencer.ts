/// <reference path="../../localtypings/pxtmusic.d.ts" />

namespace pxsim.music {
    const frequencies = [31, 33, 35, 37, 39, 41, 44, 46, 49, 52, 55, 58, 62, 65, 69, 73,
        78, 82, 87, 92, 98, 104, 110, 117, 123, 131, 139, 147, 156, 165, 175, 185, 196, 208,
        220, 233, 247, 262, 277, 294, 311, 330, 349, 370, 392, 415, 440, 466, 494, 523, 554,
        587, 622, 659, 698, 740, 784, 831, 880, 932, 988, 1047, 1109, 1175, 1245, 1319, 1397,
        1480, 1568, 1661, 1760, 1865, 1976, 2093, 2217, 2349, 2489, 2637, 2794, 2960, 3136,
        3322, 3520, 3729, 3951, 4186, 4435, 4699, 4978, 5274, 5588, 5920, 6272, 6645, 7040,
        7459, 7902];

    export type SequencerState = "play" | "loop" | "stop";
    export type SequencerEvent = "tick" | "play" | "stop" | "loop" | "state-change" | "looped";

    export class Sequencer {
        protected metronome: Metronome;
        protected _currentTick = 0;
        protected _state: SequencerState = "stop";
        protected currentlyPlaying: pxt.assets.music.Song;
        protected listeners: {[index: string]: (() => void)[]} = {};
        protected shouldLoop: boolean;
        protected globalVolume: number = 1024;
        protected trackVolumes: number[] = [];
        protected drumTrackVolumes: number[][] = [];

        protected spatialAudioPlayer: AudioContextManager.SpatialAudioPlayer;

        protected currentCancelToken = { cancelled: false };

        constructor() {
        }

        async initAsync() {
            if (this.metronome) {
                await this.metronome.initAsync();
                return;
            }

            this.metronome = new Metronome();
            await this.metronome.initAsync();
            this.metronome.addTickListener(this.onTick);
        }

        dispose() {
            if (this.metronome) this.metronome.dispose();
            this.metronome = undefined
            this.stop();
            this.currentlyPlaying = undefined;
            this.listeners = {};
        }

        state() {
            return this._state
        }

        currentTick() {
            return this._currentTick;
        }

        currentTime() {
            return tickToMs(this.currentlyPlaying.beatsPerMinute, this.currentlyPlaying.ticksPerBeat, this.currentTick());
        }

        maxTick() {
            if (!this.currentlyPlaying) return 0;
            return this.currentlyPlaying.measures * this.currentlyPlaying.beatsPerMeasure * this.currentlyPlaying.ticksPerBeat
        }

        duration() {
            return tickToMs(this.currentlyPlaying.beatsPerMinute, this.currentlyPlaying.ticksPerBeat, this.maxTick());
        }

        start(song: pxt.assets.music.Song, loop?: boolean) {
            this.startFrom(song, loop, 0);
        }

        startFrom(song: pxt.assets.music.Song, loop?: boolean, tick?: number) {
            if (this._state !== "stop") this.stop();

            if (loop !== undefined) {
                this.shouldLoop = loop;
            }

            this._currentTick = tick ?? 0;
            this.currentlyPlaying = song;
            this.metronome.start(tickToMs(song.beatsPerMinute, song.ticksPerBeat, 1));
            this._state = this.shouldLoop ? "loop" : "play";
            this.fireStateChange();
        }

        stop(sustainCurrentSounds = false) {
            if (this._state === "stop") return;
            this._state = "stop";
            if (this.metronome) this.metronome.stop();
            this.fireStateChange();

            if (!sustainCurrentSounds) this.currentCancelToken.cancelled = true;
            this.currentCancelToken = { cancelled: false };
        }

        updateSong(song: pxt.assets.music.Song) {
            this.currentlyPlaying = song;

            if (this._state !== "stop") {
                this.metronome.setInterval(tickToMs(song.beatsPerMinute, song.ticksPerBeat, 1))
            }
        }

        setLooping(looping: boolean) {
            if (looping && this._state === "play") {
                this._state = "loop";
                this.fireStateChange();
            }
            else if (!looping && this._state === "loop") {
                this._state = "play";
                this.fireStateChange();
            }
            this.shouldLoop = looping;
        }

        addEventListener(event: SequencerEvent, listener: () => void) {
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(listener);
        }

        removeEventListener(event: SequencerEvent, listener: () => void) {
            if (!this.listeners[event]) return;
            this.listeners[event] = this.listeners[event].filter(l => l !== listener);
        }

        setVolume(volume: number) {
            this.globalVolume = Math.min(Math.max(volume, 0), 1024);
        }

        setTrackVolume(trackIndex: number, volume: number) {
            volume = Math.min(Math.max(volume, 0), 1024);

            while (this.trackVolumes.length < trackIndex) {
                this.trackVolumes.push(1024);
            }

            this.trackVolumes[trackIndex] = volume;
        }

        setDrumTrackVolume(trackIndex: number, drumIndex: number, volume: number) {
            volume = Math.min(Math.max(volume, 0), 1024);

            while (this.drumTrackVolumes.length < trackIndex) {
                this.drumTrackVolumes.push([]);
            }

            while (this.drumTrackVolumes[trackIndex].length < drumIndex) {
                this.drumTrackVolumes[trackIndex].push(1024)
            }

            this.drumTrackVolumes[trackIndex][drumIndex] = volume;
        }

        setSpatialAudioPlayer(player: AudioContextManager.SpatialAudioPlayer) {
            this.spatialAudioPlayer = player;
        }

        protected getMelodicTrackVolume(trackIndex: number) {
            let trackVolume = 1024;
            if (trackIndex < this.trackVolumes.length) {
                trackVolume = this.trackVolumes[trackIndex];
            }

            return this.globalVolume * (trackVolume / 1024);
        }

        protected getDrumTrackVolume(trackIndex: number, drumIndex: number) {
            const trackVolume = this.getMelodicTrackVolume(trackIndex);
            let drumVolume = 1024;

            if (trackIndex < this.drumTrackVolumes.length && drumIndex < this.drumTrackVolumes[trackIndex].length) {
                drumVolume = this.drumTrackVolumes[trackIndex][drumIndex]
            }

            return trackVolume * (drumVolume / 1024);
        }

        protected fireStateChange() {
            this.fireEvent(this._state);
            this.fireEvent("state-change");
        }

        protected fireEvent(event: SequencerEvent) {
            if (this.listeners[event]) {
                for (const listener of this.listeners[event]) {
                    listener();
                }
            }
        }

        protected onTick = () => {
            const currentToken = this.currentCancelToken;
            for (let i = 0; i < this.currentlyPlaying.tracks.length; i++) {
                const track = this.currentlyPlaying.tracks[i];
                for (const noteEvent of track.notes) {
                    if (noteEvent.startTick === this._currentTick) {
                        for (const note of noteEvent.notes) {
                            if (this.spatialAudioPlayer) {
                                if (track.drums) {
                                    playDrumAtSpatialAudioPlayerAsync(
                                        this.spatialAudioPlayer,
                                        track.drums[note.note],
                                        this.getDrumTrackVolume(i, note.note)
                                    );
                                }
                                else {
                                    playNoteAtSpatialAudioPlayerAsync(
                                        this.spatialAudioPlayer,
                                        note.note,
                                        track.instrument,
                                        tickToMs(this.currentlyPlaying.beatsPerMinute, this.currentlyPlaying.ticksPerBeat, noteEvent.endTick - noteEvent.startTick),
                                        this.getMelodicTrackVolume(i)
                                    );
                                }
                            }
                            else {
                                if (track.drums) {
                                    playDrumAsync(track.drums[note.note], () => currentToken.cancelled, this.getDrumTrackVolume(i, note.note));
                                }
                                else {
                                    playNoteAsync(note.note, track.instrument, tickToMs(this.currentlyPlaying.beatsPerMinute, this.currentlyPlaying.ticksPerBeat, noteEvent.endTick - noteEvent.startTick), () => currentToken.cancelled, this.getMelodicTrackVolume(i));
                                }
                            }
                        }
                    }
                    else if (noteEvent.startTick > this._currentTick) {
                        break;
                    }
                }
            }

            this.fireEvent("tick");

            this._currentTick ++;

            if (this._currentTick >= this.maxTick()) {
                if (this._state === "loop") {
                    this._currentTick = 0;
                    this.fireEvent("looped");
                }
                else {
                    this.stop(true);
                }
            }
        }
    }

    export async function playNoteAsync(note: number, instrument: pxt.assets.music.Instrument, time: number, isCancelled?: () => boolean, volume = 100) {
        await pxsim.AudioContextManager.playInstructionsAsync(
            pxsim.music.renderInstrument(instrument, frequencies[note], time, volume),
            isCancelled
        )
    }

    export async function playDrumAsync(drum: pxt.assets.music.DrumInstrument, isCancelled?: () => boolean, volume = 100) {
        await pxsim.AudioContextManager.playInstructionsAsync(
            pxsim.music.renderDrumInstrument(drum, volume),
            isCancelled
        )
    }

    async function playNoteAtSpatialAudioPlayerAsync(player: AudioContextManager.SpatialAudioPlayer, note: number, instrument: pxt.assets.music.Instrument, time: number, volume = 100) {
        await player.playInstructionsAsync(
            pxsim.music.renderInstrument(instrument, frequencies[note], time, volume)
        )
    }

    async function playDrumAtSpatialAudioPlayerAsync(player: AudioContextManager.SpatialAudioPlayer, drum: pxt.assets.music.DrumInstrument, volume = 100) {
        await player.playInstructionsAsync(
            pxsim.music.renderDrumInstrument(drum, volume),
        )
    }

    export function tickToMs(beatsPerMinute: number, ticksPerBeat: number, ticks: number) {
        return ((60000 / beatsPerMinute) / ticksPerBeat) * ticks;
    }
}