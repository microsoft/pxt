export interface NoteEvent {
    id: number;
    start: number;
    duration: number;
    note: number;
}

export interface Track {
    instrumentId: number;
    events: NoteEvent[];
    id: number;
    nextId: number;
    minOctave: number;
    maxOctave: number;
}

export interface Song {
    instruments: Instrument[];

    tracks: Track[];
    measures: number;
    tempo: number;
    nextId: number;
}

interface BaseInstrument {
    name: string;
    id: number;
}

export interface MelodicInstrument extends BaseInstrument {
    instrument: pxt.assets.music.Instrument;
}

export interface DrumInstrument extends BaseInstrument {
    drums: pxt.assets.music.DrumInstrument[];
}

export type Instrument = MelodicInstrument | DrumInstrument;

export function getEmptySong(): Song {
    const makecodeSong = getEmptyPXTSong(4);

    const instruments: Instrument[] = makecodeSong.tracks.map(t => {
        if (t.drums) {
            return {
                id: t.id,
                name: t.name,
                minOctave: 0,
                maxOctave: 1,
                drums: t.drums
            } as DrumInstrument;
        }
        else {
            return {
                id: t.id,
                name: t.name,
                instrument: t.instrument,
                minOctave: 3,
                maxOctave: 5
            } as MelodicInstrument;
        }
    });

    const song: Song = {
        nextId: 1,
        instruments,
        tracks: [{
            instrumentId: 0,
            events: [],
            nextId: 0,
            id: 0,
            minOctave: 3,
            maxOctave: 5
        }],
        measures: 2,
        tempo: 120
    };

    return song;
}

export function getNextNoteEvent(note: number, start: number, track: Track): NoteEvent | undefined {
    return track.events.find(e => e.note === note && e.start > start);
}

export function getMaxDuration(note: number, start: number, track: Track, measures: number): number {
    const nextEvent = getNextNoteEvent(note, start, track);
    if (!nextEvent) return measures * 4 * 4 - start;

    return nextEvent.start - start;
}

export function newNoteEvent(note: number, start: number, track: Track, isDrumTrack: boolean, measures: number): Track {
    const newEvent: NoteEvent = {
        id: track.nextId++,
        note,
        start,
        duration: isDrumTrack ? 1 : Math.min(4, getMaxDuration(note, start, track, measures))
    };

    return insertNoteEvent(newEvent, track);
}

export function changeNoteEventDuration(id: number, duration: number, track: Track, measures: number): Track {
    const eventIndex = track.events.findIndex(e => e.id === id);
    if (eventIndex === -1) return track;

    const event = track.events[eventIndex];
    const maxDuration = getMaxDuration(event.note, event.start, track, measures);

    const updatedEvent = {
        ...event,
        duration: Math.max(1, Math.min(duration, maxDuration))
    };

    return {
        ...track,
        events: [
            ...track.events.slice(0, eventIndex),
            updatedEvent,
            ...track.events.slice(eventIndex + 1)
        ]
    };
}

function insertNoteEvent(newEvent: NoteEvent, track: Track): Track {
    for (let i = 0; i < track.events.length; i++) {
        if (track.events[i].start > newEvent.start) {
            return {
                ...track,
                events: [
                    ...track.events.slice(0, i),
                    newEvent,
                    ...track.events.slice(i)
                ]
            };
        }
    }

    return {
        ...track,
        events: [...track.events, newEvent]
    }
}

export function newTrack(instrumentId: number, song: Song): Song {
    const newTrack: Track = {
        instrumentId,
        events: [],
        id: song.nextId++,
        nextId: 0,
        minOctave: 3,
        maxOctave: 5
    };

    return {
        ...song,
        tracks: [...song.tracks, newTrack]
    };
}

export function updateTrack(updatedTrack: Track, song: Song): Song {
    const trackIndex = song.tracks.findIndex(t => t.id === updatedTrack.id);
    if (trackIndex === -1) return song;

    return {
        ...song,
        tracks: [
            ...song.tracks.slice(0, trackIndex),
            updatedTrack,
            ...song.tracks.slice(trackIndex + 1)
        ]
    };
}

export function changeTrackInstrument(trackId: number, instrumentId: number, song: Song): Song {
    const trackIndex = song.tracks.findIndex(t => t.id === trackId);
    const track =  { ...song.tracks[trackIndex] };

    const oldInstrument = song.instruments.find(i => i.id === track.instrumentId)!;
    const newInstrument = song.instruments.find(i => i.id === instrumentId)!;

    if (isDrumInstrument(oldInstrument) !== isDrumInstrument(newInstrument)) {
        track.events = [];
    }

    track.instrumentId = instrumentId;

    return updateTrack(track, song);
}

export function changeMeasures(measures: number, song: Song): Song {
    return {
        ...song,
        measures,
        tracks: song.tracks.map(track => ({
            ...track,
            events: track.events.filter(e => e.start < measures * 4 * 4).map(e => ({
                ...e,
                duration: Math.min(e.duration, measures * 4 * 4 - e.start)
            }))
        }))
    }
}

export function changeOctaves(trackId: number, minOctave: number, maxOctave: number, song: Song): Song {
    const trackIndex = song.tracks.findIndex(t => t.id === trackId);
    const track = song.tracks[trackIndex];

    return {
        ...song,
        tracks: [
            ...song.tracks.slice(0, trackIndex),
            {
                ...track,
                minOctave,
                maxOctave,
                events: track.events.filter(e => e.note >= minOctave * 12 && e.note < maxOctave * 12)
            },
            ...song.tracks.slice(trackIndex + 1)
        ]
    }
}

export function isDrumInstrument(instrument: Instrument): instrument is DrumInstrument {
    return (instrument as DrumInstrument).drums !== undefined;
}

export function isMelodicInstrument(instrument: Instrument): instrument is MelodicInstrument {
    return (instrument as MelodicInstrument).instrument !== undefined;
}

export const lf = pxt.U.lf;

export function toPXTSong(song: Song): pxt.assets.music.Song {
    return {
        ticksPerBeat: 4,
        beatsPerMeasure: 4,
        beatsPerMinute: song.tempo,
        measures: song.measures,
        tracks: song.tracks.map(track => {
            const instrument = song.instruments.find(i => i.id === track.instrumentId)!;

            const pxtTrack: pxt.assets.music.Track = {
                id: track.instrumentId,
                name: instrument.name,
                notes: track.events.map(e => ({
                    startTick: e.start,
                    endTick: (e.start + e.duration),
                    notes: [{
                        note: e.note,
                        enharmonicSpelling: "normal"
                    }]
                 })),
                instrument: isDrumInstrument(instrument) ? undefined : (instrument as MelodicInstrument).instrument,
                drums: isDrumInstrument(instrument) ? (instrument as DrumInstrument).drums : undefined
            }

            return pxtTrack;
        })
    }
}


function getEmptyPXTSong(measures: number): pxt.assets.music.Song {
    return {
        ticksPerBeat: 8,
        beatsPerMeasure: 4,
        beatsPerMinute: 120,
        measures,
        tracks: [
            {
                id: 0,
                name: lf("Dog"),
                notes: [],
                iconURI: "music-editor/dog.png",
                instrument: {
                    waveform: 1,
                    octave: 4,
                    ampEnvelope: {
                        attack: 10,
                        decay: 100,
                        sustain: 500,
                        release: 100,
                        amplitude: 1024
                    },
                    pitchLFO: {
                        frequency: 5,
                        amplitude: 0
                    }
                }
            },
            {
                id: 1,
                name: lf("Duck"),
                notes: [],
                iconURI: "music-editor/duck.png",
                instrument: {
                    waveform: 15,
                    octave: 4,
                    ampEnvelope: {
                        attack: 5,
                        decay: 530,
                        sustain: 705,
                        release: 450,
                        amplitude: 1024
                    },
                    pitchEnvelope: {
                        attack: 5,
                        decay: 40,
                        sustain: 0,
                        release: 100,
                        amplitude: 40
                    },
                    ampLFO: {
                        frequency: 3,
                        amplitude: 20
                    },
                    pitchLFO: {
                        frequency: 6,
                        amplitude: 2
                    }
                }
            },
            {
                id: 2,
                name: lf("Cat"),
                notes: [],
                iconURI: "music-editor/cat.png",
                instrument: {
                    waveform: 12,
                    octave: 5,
                    ampEnvelope: {
                        attack: 150,
                        decay: 100,
                        sustain: 365,
                        release: 400,
                        amplitude: 1024
                    },
                    pitchEnvelope: {
                        attack: 120,
                        decay: 300,
                        sustain: 0,
                        release: 100,
                        amplitude: 50
                    },
                    pitchLFO: {
                        frequency: 10,
                        amplitude: 6
                    }
                }
            },
            {
                id: 3,
                name: lf("Fish"),
                notes: [],
                iconURI: "music-editor/fish.png",
                instrument: {
                    waveform: 1,
                    octave: 3,
                    ampEnvelope: {
                        attack: 220,
                        decay: 105,
                        sustain: 1024,
                        release: 350,
                        amplitude: 1024
                    },
                    ampLFO: {
                        frequency: 5,
                        amplitude: 100
                    },
                    pitchLFO: {
                        frequency: 1,
                        amplitude: 4
                    }
                }
            },
            {
                id: 4,
                name: lf("Car"),
                notes: [],
                iconURI: "music-editor/car.png",
                instrument: {
                    waveform: 16,
                    octave: 4,
                    ampEnvelope: {
                        attack: 5,
                        decay: 100,
                        sustain: 1024,
                        release: 30,
                        amplitude: 1024
                    },
                    pitchLFO: {
                        frequency: 10,
                        amplitude: 4
                    }
                }
            },
            {
                id: 5,
                name: lf("Computer"),
                notes: [],
                iconURI: "music-editor/computer.png",
                instrument: {
                    waveform: 15,
                    octave: 2,
                    ampEnvelope: {
                        attack: 10,
                        decay: 100,
                        sustain: 500,
                        release: 10,
                        amplitude: 1024
                    }
                }
            },
            {
                id: 6,
                name: lf("Burger"),
                notes: [],
                iconURI: "music-editor/burger.png",
                instrument: {
                    waveform: 1,
                    octave: 2,
                    ampEnvelope: {
                        attack: 10,
                        decay: 100,
                        sustain: 500,
                        release: 100,
                        amplitude: 1024
                    }
                }
            },
            {
                id: 7,
                name: lf("Cherry"),
                notes: [],
                iconURI: "music-editor/cherry.png",
                instrument: {
                    waveform: 2,
                    octave: 3,
                    ampEnvelope: {
                        attack: 10,
                        decay: 100,
                        sustain: 500,
                        release: 100,
                        amplitude: 1024
                    }
                }
            },
            {
                id: 8,
                name: lf("Lemon"),
                notes: [],
                iconURI: "music-editor/lemon.png",
                instrument: {
                    waveform: 14,
                    octave: 2,
                    ampEnvelope: {
                        attack: 5,
                        decay: 70,
                        sustain: 870,
                        release: 50,
                        amplitude: 1024
                    },
                    pitchEnvelope: {
                        attack: 10,
                        decay: 45,
                        sustain: 0,
                        release: 100,
                        amplitude: 20
                    },
                    ampLFO: {
                        frequency: 1,
                        amplitude: 50
                    },
                    pitchLFO: {
                        frequency: 2,
                        amplitude: 1
                    }
                }
            },
            {
                id: 9,
                name: lf("Drums"),
                notes: [],
                iconURI: "music-editor/explosion.png",
                instrument: {
                    waveform: 11,
                    octave: 4,
                    ampEnvelope: {
                        attack: 10,
                        decay: 100,
                        sustain: 500,
                        release: 100,
                        amplitude: 1024
                    }
                },
                drums: [
                    {
                        name: lf("neutral kick"),
                        startFrequency: 100,
                        startVolume: 1024,
                        steps: [
                            {
                                waveform: 3,
                                frequency: 120,
                                duration: 10,
                                volume: 1024
                            },
                            {
                                waveform: 3,
                                frequency: 1,
                                duration: 100,
                                volume: 0
                            }
                        ]
                    },
                    {
                        name: lf("punchy kick"),
                        startFrequency: 200,
                        startVolume: 1024,
                        steps: [{
                            frequency: 0,
                            volume: 0,
                            duration: 100,
                            waveform: 1
                        }]
                    },

                    {
                        name: lf("booming kick"),
                        startFrequency: 100,
                        startVolume: 1024,
                        steps: [{
                            frequency: 0,
                            volume: 0,
                            duration: 250,
                            waveform: 1
                        }]
                    },


                    {
                        name: lf("snare 1"),
                        startFrequency: 175,
                        startVolume: 1024,
                        steps: [
                            {
                                waveform: 1,
                                frequency: 200,
                                duration: 10,
                                volume: 1024
                            },
                            {
                                waveform: 1,
                                frequency: 150,
                                duration: 20,
                                volume: 1024
                            },
                            {
                                waveform: 5,
                                frequency: 1,
                                duration: 20,
                                volume: 100
                            },
                            {
                                waveform: 5,
                                frequency: 1,
                                duration: 300,
                                volume: 0
                            },
                        ]
                    },

                    {
                        name: lf("snare 2"),
                        startFrequency: 220,
                        startVolume: 1024,
                        steps: [
                            {
                                waveform: 1,
                                frequency: 250,
                                duration: 10,
                                volume: 1024
                            },
                            {
                                waveform: 1,
                                frequency: 200,
                                duration: 20,
                                volume: 1024
                            },
                            {
                                waveform: 5,
                                frequency: 2000,
                                duration: 20,
                                volume: 100
                            },
                            {
                                waveform: 5,
                                frequency: 2000,
                                duration: 200,
                                volume: 0
                            },
                        ]
                    },


                    {
                        name: lf("hat 1"),
                        startFrequency: 400,
                        startVolume: 500,
                        steps: [
                            {
                                frequency: 450,
                                volume: 500,
                                duration: 10,
                                waveform: 5
                            },
                            {
                                frequency: 400,
                                volume: 20,
                                duration: 20,
                                waveform: 5
                            },
                        ]
                    },

                    {
                        name: lf("hat 2"),
                        startFrequency: 400,
                        startVolume: 0,
                        steps: [
                            {
                                frequency: 450,
                                volume: 500,
                                duration: 5,
                                waveform: 5
                            },
                            {
                                frequency: 900,
                                volume: 5,
                                duration: 50,
                                waveform: 5
                            },
                            {
                                frequency: 900,
                                volume: 0,
                                duration: 250,
                                waveform: 5
                            }
                        ]
                    },


                    {
                        name: lf("hat 3"),
                        startFrequency: 400,
                        startVolume: 0,
                        steps: [
                            {
                                frequency: 450,
                                volume: 500,
                                duration: 5,
                                waveform: 5
                            },
                            {
                                frequency: 900,
                                volume: 200,
                                duration: 50,
                                waveform: 5
                            },
                            {
                                frequency: 900,
                                volume: 5,
                                duration: 100,
                                waveform: 5
                            },
                            {
                                frequency: 900,
                                volume: 0,
                                duration: 400,
                                waveform: 5
                            }
                        ]
                    },

                    {
                        name: lf("hat 4"),
                        startFrequency: 400,
                        startVolume: 0,
                        steps: [
                            {
                                frequency: 450,
                                volume: 500,
                                duration: 5,
                                waveform: 5
                            },
                            {
                                frequency: 900,
                                volume: 200,
                                duration: 100,
                                waveform: 5
                            },
                            {
                                frequency: 900,
                                volume: 5,
                                duration: 200,
                                waveform: 5
                            },
                            {
                                frequency: 900,
                                volume: 0,
                                duration: 500,
                                waveform: 5
                            }
                        ]
                    },

                    {
                        name: lf("double hat"),
                        startFrequency: 3500,
                        startVolume: 1024,
                        steps: [
                            {
                                frequency: 4000,
                                volume: 0,
                                duration: 10,
                                waveform: 4
                            },
                            {
                                frequency: 3500,
                                volume: 800,
                                duration: 1,
                                waveform: 4
                            },
                            {
                                frequency: 4000,
                                volume: 0,
                                duration: 40,
                                waveform: 4
                            },
                            {
                                frequency: 3500,
                                volume: 400,
                                duration: 1,
                                waveform: 4
                            },
                            {
                                frequency: 4000,
                                volume: 0,
                                duration: 40,
                                waveform: 4
                            },
                        ]
                    },

                    {
                        name: lf("metallic"),
                        startFrequency: 2000,
                        startVolume: 1024,
                        steps: [
                            {
                                frequency: 1800,
                                volume: 15,
                                duration: 100,
                                waveform: 4
                            },
                            {
                                frequency: 1800,
                                volume: 0,
                                duration: 200,
                                waveform: 4
                            }
                        ]
                    },

                    {
                        name: lf("low tom"),
                        startFrequency: 200,
                        startVolume: 200,
                        steps: [
                            {
                                frequency: 125,
                                volume: 200,
                                duration: 25,
                                waveform: 14
                            },
                            {
                                frequency: 100,
                                volume: 15,
                                duration: 50,
                                waveform: 14
                            },
                            {
                                frequency: 120,
                                volume: 0,
                                duration: 250,
                                waveform: 14
                            }
                        ]
                    },

                    {
                        name: lf("mid tom"),
                        startFrequency: 300,
                        startVolume: 200,
                        steps: [
                            {
                                frequency: 225,
                                volume: 200,
                                duration: 25,
                                waveform: 14
                            },
                            {
                                frequency: 200,
                                volume: 15,
                                duration: 50,
                                waveform: 14
                            },
                            {
                                frequency: 220,
                                volume: 0,
                                duration: 250,
                                waveform: 14
                            }
                        ]
                    },

                    {
                        name: lf("hi tom"),
                        startFrequency: 500,
                        startVolume: 200,
                        steps: [
                            {
                                frequency: 425,
                                volume: 200,
                                duration: 25,
                                waveform: 14
                            },
                            {
                                frequency: 400,
                                volume: 15,
                                duration: 50,
                                waveform: 14
                            },
                            {
                                frequency: 420,
                                volume: 0,
                                duration: 250,
                                waveform: 14
                            }
                        ]
                    },
                    {
                        name: lf("lo tom 2"),
                        startFrequency: 200,
                        startVolume: 1024,
                        steps: [
                            {
                                frequency: 75,
                                volume: 0,
                                duration: 200,
                                waveform: 1
                            }
                        ]
                    },
                    {
                        name: lf("mid tom 2"),
                        startFrequency: 300,
                        startVolume: 1024,
                        steps: [
                            {
                                frequency: 200,
                                volume: 0,
                                duration: 200,
                                waveform: 1
                            }
                        ]
                    },


                    {
                        name: lf("hi tom 2"),
                        startFrequency: 400,
                        startVolume: 1024,
                        steps: [
                            {
                                frequency: 300,
                                volume: 0,
                                duration: 200,
                                waveform: 1
                            }
                        ]
                    },


                    {
                        name: lf("thump 1"),
                        startFrequency: 200,
                        startVolume: 1024,
                        steps: [
                            {
                                frequency: 200,
                                volume: 15,
                                duration: 100,
                                waveform: 4
                            },
                            {
                                frequency: 150,
                                volume: 0,
                                duration: 200,
                                waveform: 4
                            }
                        ]
                    },

                    {
                        name: lf("thump 2"),
                        startFrequency: 450,
                        startVolume: 1024,
                        steps: [
                            {
                                frequency: 350,
                                volume: 15,
                                duration: 100,
                                waveform: 4
                            },
                            {
                                frequency: 300,
                                volume: 0,
                                duration: 100,
                                waveform: 4
                            }
                        ]
                    },

                    {
                        name: lf("cymbal"),
                        startFrequency: 2500,
                        startVolume: 1024,
                        steps: [
                            {
                                frequency: 2500,
                                volume: 100,
                                duration: 150,
                                waveform: 4
                            },
                            {
                                frequency: 2550,
                                volume: 0,
                                duration: 500,
                                waveform: 4
                            }
                        ]
                    },

                    {
                        name: lf("crash 1"),
                        startFrequency: 3000,
                        startVolume: 1024,
                        steps: [
                            {
                                frequency: 3000,
                                volume: 100,
                                duration: 300,
                                waveform: 4
                            },
                            {
                                frequency: 3060,
                                volume: 0,
                                duration: 500,
                                waveform: 4
                            }
                        ]
                    },

                    {
                        name: lf("crash 2"),
                        startFrequency: 800,
                        startVolume: 0,
                        steps: [
                            {
                                frequency: 800,
                                volume: 1024,
                                duration: 10,
                                waveform: 4
                            },
                            {
                                frequency: 800,
                                volume: 0,
                                duration: 490,
                                waveform: 4
                            }
                        ]
                    },

                    {
                        name: lf("crash 3"),
                        startFrequency: 400,
                        startVolume: 0,
                        steps: [
                            {
                                frequency: 400,
                                volume: 1024,
                                duration: 10,
                                waveform: 4
                            },
                            {
                                frequency: 400,
                                volume: 0,
                                duration: 400,
                                waveform: 4
                            }
                        ]
                    },

                    {
                        name: lf("buzzer"),
                        startFrequency: 2000,
                        startVolume: 1024,
                        steps: [
                            {
                                frequency: 2000,
                                volume: 100,
                                duration: 150,
                                waveform: 16
                            },
                            {
                                frequency: 2000,
                                volume: 0,
                                duration: 200,
                                waveform: 16
                            }
                        ]
                    },]
            }
        ]
    }
}