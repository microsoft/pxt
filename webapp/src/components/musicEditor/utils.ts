export function addNoteToTrack(song: pxt.assets.music.Song, trackIndex: number, note: number, startTick: number) {
    return {
        ...song,
        tracks: song.tracks.map((track, index) => index !== trackIndex ? track : {
            ...track,
            notes: addToNoteArray(track.notes, note, startTick, startTick + 1)
        })
    }
}

function addToNoteArray(notes: pxt.assets.music.NoteEvent[], note: number, startTick: number, endTick: number) {
    const noteEvent: pxt.assets.music.NoteEvent = {
        notes: [note],
        startTick,
        endTick
    };

    for (let i = 0; i < notes.length; i++) {
        if (notes[i].startTick > startTick) {
            return notes.slice(0, i).concat([noteEvent]).concat(notes.slice(i));
        }
        else if (notes[i].endTick > startTick) {
            return notes.map((event, index) => index !== i ? event : {
                ...event,
                notes: event.notes.concat([note])
            })
        }
    }
    return notes.slice().concat([noteEvent]);
}


export function getEmptySong(measures: number): pxt.assets.music.Song {
    return {
        ticksPerBeat: 8,
        beatsPerMeasure: 4,
        beatsPerMinute: 120,
        measures,
        tracks: [
            {
                name: lf("Duck"),
                notes: [],
                iconURI: "/static/music-editor/duck.png",
                instrument: {
                    waveform: 11,
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
                        amplitude: 2
                    }
                }
            },
            {
                name: lf("Cat"),
                notes: [],
                iconURI: "/static/music-editor/cat.png",
                instrument: {
                    waveform: 11,
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
                        amplitude: 2
                    }
                }
            },
            {
                name: lf("Dog"),
                notes: [],
                iconURI: "/static/music-editor/dog.png",
                instrument: {
                    waveform: 11,
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
                        amplitude: 2
                    }
                }
            },
            {
                name: lf("Fish"),
                notes: [],
                iconURI: "/static/music-editor/fish.png",
                instrument: {
                    waveform: 11,
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
                        amplitude: 2
                    }
                }
            },
            {
                name: lf("Car"),
                notes: [],
                iconURI: "/static/music-editor/car.png",
                instrument: {
                    waveform: 11,
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
                        amplitude: 2
                    }
                }
            },
            {
                name: lf("Computer"),
                notes: [],
                iconURI: "/static/music-editor/computer.png",
                instrument: {
                    waveform: 11,
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
                        amplitude: 2
                    }
                }
            },
            {
                name: lf("Burger"),
                notes: [],
                iconURI: "/static/music-editor/burger.png",
                instrument: {
                    waveform: 11,
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
                        amplitude: 2
                    }
                }
            },
            {
                name: lf("Cherry"),
                notes: [],
                iconURI: "/static/music-editor/cherry.png",
                instrument: {
                    waveform: 11,
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
                        amplitude: 2
                    }
                }
            },
            {
                name: lf("Lemon"),
                notes: [],
                iconURI: "/static/music-editor/lemon.png",
                instrument: {
                    waveform: 11,
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
                        amplitude: 2
                    }
                }
            },
            {
                name: lf("Explosion"),
                notes: [],
                iconURI: "/static/music-editor/explosion.png",
                instrument: {
                    waveform: 11,
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
                        amplitude: 2
                    }
                }
            }
        ]
    }
}