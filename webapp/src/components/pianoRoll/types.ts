export interface NoteEvent {
    id: number;
    start: number;
    duration: number;
    note: number;
    velocity: number;
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

export const lf = pxt.U.lf;

export const NOTE_RANGES = [
    {
        name: lf("Treble"),
        id: "treble",
        minOctave: 3,
        maxOctave: 5
    },
    {
        name: lf("Bass"),
        id: "bass",
        minOctave: 0,
        maxOctave: 3
    },
    {
        name: lf("Full"),
        id: "full",
        minOctave: 0,
        maxOctave: 7
    }
]

export function getEmptySong(): Song {
    const makecodeSong = pxt.assets.music.getEmptySong(4);

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
        duration: isDrumTrack ? 1 : Math.min(4, getMaxDuration(note, start, track, measures)),
        velocity: 128
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
    const range = NOTE_RANGES.find(r => r.id === "treble")!;
    const newTrack: Track = {
        instrumentId,
        events: [],
        id: song.nextId++,
        nextId: 0,
        minOctave: range.minOctave,
        maxOctave: range.maxOctave
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

export function updateNoteEvent(song: Song, trackId: number, updatedEvent: NoteEvent): Song {
    const trackIndex = song.tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) return song;

    const track = song.tracks[trackIndex];
    const eventIndex = track.events.findIndex(e => e.id === updatedEvent.id);
    if (eventIndex === -1) return song;

    const updatedTrack = {
        ...track,
        events: [
            ...track.events.slice(0, eventIndex),
            updatedEvent,
            ...track.events.slice(eventIndex + 1)
        ]
    };

    return updateTrack(updatedTrack, song);
}

export function updateNoteEvents(song: Song, trackId: number, updatedEvents: NoteEvent[]): Song {
    const trackIndex = song.tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) return song;

    const track = song.tracks[trackIndex];

    const updatedTrack = {
        ...track,
        events: track.events.map(e => {
            const updatedEvent = updatedEvents.find(ue => ue.id === e.id);
            return updatedEvent ? updatedEvent : e;
        })
    };

    return updateTrack(updatedTrack, song);
}

export function changeTrackInstrument(trackId: number, instrumentId: number, song: Song): Song {
    const trackIndex = song.tracks.findIndex(t => t.id === trackId);
    const track = { ...song.tracks[trackIndex] };

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
                    }],
                    velocity: e.velocity
                })),
                instrument: isDrumInstrument(instrument) ? undefined : (instrument as MelodicInstrument).instrument,
                drums: isDrumInstrument(instrument) ? (instrument as DrumInstrument).drums : undefined
            }

            return pxtTrack;
        })
    }
}

export function fromPXTSong(pxtSong: pxt.assets.music.Song): Song {
    const result = getEmptySong();

    result.tracks = [];
    result.nextId += 100;

    const ticksPerSixteenth = pxtSong.ticksPerBeat / 4;

    let instrumentIdCounter = 0;
    for (const track of pxtSong.tracks) {
        const newTrack: Track = {
            id: track.id,
            instrumentId: 0,
            events: [],
            nextId: 0,
            minOctave: 7,
            maxOctave: 0
        }

        const newNoteEvent = (note: number, startTick: number, endTick: number, velocity: number): void => {
            const newEvent: NoteEvent = {
                id: newTrack.nextId++,
                note,
                start: Math.round(startTick / ticksPerSixteenth),
                duration: Math.round((endTick - startTick) / ticksPerSixteenth),
                velocity: velocity ?? 128
            };

            newTrack.events.push(newEvent);

            const octave = Math.floor(note / 12);
            newTrack.minOctave = Math.min(newTrack.minOctave, octave);
            newTrack.maxOctave = Math.max(newTrack.maxOctave, octave);
        };

        if (track.drums?.length) {
            newTrack.instrumentId = result.instruments.find(i => isDrumInstrument(i))!.id;
        }
        else {
            const instrument = result.instruments.find(i => !isDrumInstrument(i) && instrumentsEqual(i.instrument, track.instrument));

            if (instrument) newTrack.instrumentId = instrument.id;
            else {
                const newInstrument: MelodicInstrument = {
                    id: result.nextId++,
                    name: lf("Instrument {0}", instrumentIdCounter++),
                    instrument: track.instrument,
                };
                result.instruments.push(newInstrument);
                newTrack.instrumentId = newInstrument.id;
            }
        }

        for (const event of track.notes) {
            for (const note of event.notes) {
                newNoteEvent(note.note, event.startTick, event.endTick, event.velocity);
            }
        }

        const range = NOTE_RANGES.find(r => r.minOctave <= newTrack.minOctave && r.maxOctave >= newTrack.maxOctave);
        if (range) {
            newTrack.minOctave = range.minOctave;
            newTrack.maxOctave = range.maxOctave;
        }

        if (newTrack.events.length > 0 || result.tracks.length === 0) {
            result.tracks.push(newTrack);
        }
    }

    return result;
}

function instrumentsEqual(a: pxt.assets.music.Instrument, b: pxt.assets.music.Instrument) {
    if (a.waveform !== b.waveform) return false;
    if (a.octave !== b.octave) return false;

    if (!envelopesEqual(a.ampEnvelope, b.ampEnvelope)) return false;
    if (!envelopesEqual(a.pitchEnvelope, b.pitchEnvelope)) return false;
    if (!lfosEqual(a.ampLFO, b.ampLFO)) return false;
    if (!lfosEqual(a.pitchLFO, b.pitchLFO)) return false;

    return true;
}

function envelopesEqual(a: pxt.assets.music.Envelope | undefined, b: pxt.assets.music.Envelope | undefined) {
    if (a === b) return true;
    if (!a || !b) return false;

    if (a.attack !== b.attack) return false;
    if (a.decay !== b.decay) return false;
    if (a.sustain !== b.sustain) return false;
    if (a.release !== b.release) return false;
    if (a.amplitude !== b.amplitude) return false;

    return true;
}

function lfosEqual(a: pxt.assets.music.LFO | undefined, b: pxt.assets.music.LFO | undefined) {
    if (a === b) return true;
    if (!a || !b) return false;

    if (a.frequency !== b.frequency) return false;
    if (a.amplitude !== b.amplitude) return false;

    return true;
}