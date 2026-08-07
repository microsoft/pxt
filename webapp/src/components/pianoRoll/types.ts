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
    nextInstrumentId: number;

    beatsPerMeasure: number;
    ticksPerBeat: number;

    floatingLayer?: {
        events: NoteEvent[];
        startTick: number;
        endTick: number;
        trackId: number;
    }
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

export interface WorkspaceSelection {
    startTick: number;
    endTick: number;
}

export interface CopyData {
    startTick: number;
    endTick: number;
    events: NoteEvent[];
    isDrumTrack: boolean;
}

export const lf = pxt.U.lf;

export const TIME_SIGNATURES = [
    {
        name: lf("4/4"),
        id: "ts4-4",
        beatsPerMeasure: 4,
        ticksPerBeat: 4
    },
    {
        name: lf("3/4"),
        id: "ts3-4",
        beatsPerMeasure: 3,
        ticksPerBeat: 4
    },
    {
        name: lf("2/4"),
        id: "ts2-4",
        beatsPerMeasure: 2,
        ticksPerBeat: 4
    },
    {
        name: lf("3/8"),
        id: "ts3-8",
        beatsPerMeasure: 3,
        ticksPerBeat: 2
    },
    {
        name: lf("6/8"),
        id: "ts6-8",
        beatsPerMeasure: 6,
        ticksPerBeat: 2
    },
    {
        name: lf("12/8"),
        id: "ts12-8",
        beatsPerMeasure: 12,
        ticksPerBeat: 2
    }
]

export const SNAP_OPTIONS = [
    {
        name: lf("1/4"),
        id: "quarter",
        ticksPerSnap: 4
    },
    {
        name: lf("1/8"),
        id: "eighth",
        ticksPerSnap: 2
    },
    {
        name: lf("1/16"),
        id: "sixteenth",
        ticksPerSnap: 1
    }
];

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

    let nextInstrumentId = 0;

    const instruments: Instrument[] = makecodeSong.tracks.map(t => {
        nextInstrumentId = Math.max(nextInstrumentId, t.id + 1);

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
        nextInstrumentId,
        instruments,
        beatsPerMeasure: 4,
        ticksPerBeat: 4,
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

export function getNextNoteEvent(note: number, start: number, track: Track, maxPolyphony: number): NoteEvent | undefined {
    return track.events.find(e => e.note === note && e.start > start);
}

export function getMaxDuration(note: number, start: number, track: Track, maxTicks: number, maxPolyphony: number): number {
    let activeNotes: NoteEvent[] = [];

    for (const event of track.events) {
        if (event.start === start && event.note === note) continue;

        activeNotes.push(event);
        if (event.start >= start) {
            if (event.note === note || activeNotes.length >= maxPolyphony) {
                return event.start - start;
            }
        }
        activeNotes = activeNotes.filter(e => e.start + e.duration < event.start);
    }

    return maxTicks - start;
}

export function newNoteEvent(note: number, start: number, duration: number, track: Track, isDrumTrack: boolean, maxTicks: number, maxPolyphony: number): Track {
    track = removeEventAtTimeIfNeeded(start, track, maxPolyphony);

    const newEvent: NoteEvent = {
        id: track.nextId++,
        note,
        start,
        duration: isDrumTrack ? 1 : Math.min(duration, getMaxDuration(note, start, track, maxTicks, maxPolyphony)),
        velocity: 128
    };

    return insertNoteEvent(newEvent, track);
}

export function changeNoteEventDuration(id: number, duration: number, track: Track, maxTicks: number, maxPolyphony: number): Track {
    const eventIndex = track.events.findIndex(e => e.id === id);
    if (eventIndex === -1) return track;

    const event = track.events[eventIndex];
    const maxDuration = getMaxDuration(event.note, event.start, track, maxTicks, maxPolyphony);

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

function removeEventAtTimeIfNeeded(start: number, track: Track, maxPolyphony: number): Track {
    if (maxPolyphony === Infinity) return track;

    const activeNotes = track.events.filter(e => e.start <= start && e.start + e.duration > start);
    if (activeNotes.length < maxPolyphony) return track;

    const eventToRemove = activeNotes.reduce((prev, current) => (prev.start > current.start) ? prev : current);

    return {
        ...track,
        events: track.events.filter(e => e.id !== eventToRemove.id)
    }
}

function getNewTrackId(song: Song): number {
    let id = 0;
    while (song.tracks.some(t => t.id === id)) {
        id++;
    }
    return id;
}

export function newTrack(instrumentId: number, song: Song): Song {
    const range = NOTE_RANGES.find(r => r.id === "treble")!;
    const newTrack: Track = {
        instrumentId,
        events: [],
        id: getNewTrackId(song),
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
    const maxTicks = measures * song.beatsPerMeasure * song.ticksPerBeat;
    return {
        ...song,
        measures,
        tracks: song.tracks.map(track => ({
            ...track,
            events: track.events.filter(e => e.start < maxTicks).map(e => ({
                ...e,
                duration: Math.min(e.duration, maxTicks - e.start)
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
    song = applyFloatingLayer(song);

    return {
        ticksPerBeat: song.ticksPerBeat,
        beatsPerMeasure: song.beatsPerMeasure,
        beatsPerMinute: song.tempo,
        measures: song.measures,
        tracks: song.tracks.map(track => {
            const instrument = song.instruments.find(i => i.id === track.instrumentId)!;
            const isDrums = isDrumInstrument(instrument);

            const pxtTrack: pxt.assets.music.Track = {
                id: track.id,
                name: instrument.name,
                notes: track.events.map(e => ({
                    startTick: e.start,
                    endTick: (e.start + e.duration),
                    notes: [{
                        note: isDrums ? e.note : e.note + 1,
                        enharmonicSpelling: "normal"
                    }],
                    velocity: e.velocity
                })),
                instrument: isDrums ? undefined : (instrument as MelodicInstrument).instrument,
                drums: isDrums ? (instrument as DrumInstrument).drums : undefined
            }

            return pxtTrack;
        })
    }
}

export function fromPXTSong(pxtSong: pxt.assets.music.Song): Song {
    const result = getEmptySong();
    result.measures = pxtSong.measures;
    result.tempo = pxtSong.beatsPerMinute;

    result.tracks = [];

    const ticksPerSixteenth = pxtSong.ticksPerBeat === 8 ? 2 : 1;

    result.beatsPerMeasure = pxtSong.beatsPerMeasure;
    result.ticksPerBeat = pxtSong.ticksPerBeat === 8 ? 4 : pxtSong.ticksPerBeat;

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
                note: track.drums?.length ? note : note - 1,
                start: Math.round(startTick / ticksPerSixteenth),
                duration: Math.max(1, Math.round((endTick - startTick) / ticksPerSixteenth)),
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
                    id: result.nextInstrumentId++,
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

    if (result.tracks.length === 0) {
        result.tracks.push({
            id: 0,
            instrumentId: result.instruments[0].id,
            events: [],
            nextId: 0,
            minOctave: NOTE_RANGES[0].minOctave,
            maxOctave: NOTE_RANGES[0].maxOctave
        })
    }

    return result;
}

export function changeTimeSignature(beatsPerMeasure: number, ticksPerBeat: number, song: Song): Song {
    const prevTotalTicks = song.measures * song.beatsPerMeasure * song.ticksPerBeat;
    const newMeasures = Math.ceil(prevTotalTicks / (beatsPerMeasure * ticksPerBeat));

    return {
        ...song,
        measures: newMeasures,
        beatsPerMeasure,
        ticksPerBeat
    };
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
    if (!a) {
        if (!b) return true;
        if (b.amplitude === 0) return true;
        return false;
    }
    else if (!b) {
        if (a.amplitude === 0) return true;
        return false;
    }

    if (a.attack !== b.attack) return false;
    if (a.decay !== b.decay) return false;
    if (a.sustain !== b.sustain) return false;
    if (a.release !== b.release) return false;
    if (a.amplitude !== b.amplitude) return false;

    return true;
}

function lfosEqual(a: pxt.assets.music.LFO | undefined, b: pxt.assets.music.LFO | undefined) {
    if (a === b) return true;
        if (!a) {
        if (!b) return true;
        if (b.amplitude === 0) return true;
        return false;
    }
    else if (!b) {
        if (a.amplitude === 0) return true;
        return false;
    }

    if (a.frequency !== b.frequency) return false;
    if (a.amplitude !== b.amplitude) return false;

    return true;
}

export function applyFloatingLayer(song: Song): Song {
    if (!song.floatingLayer) return song;

    const track = song.tracks.find(t => t.id === song.floatingLayer!.trackId);
    if (!track) return song;

    const copyData: CopyData = {
        startTick: song.floatingLayer.startTick,
        endTick: song.floatingLayer.endTick,
        events: song.floatingLayer.events,
        isDrumTrack: isDrumInstrument(song.instruments.find(i => i.id === track.instrumentId)!)
    };

    const result = pasteCopyData(song, song.floatingLayer.trackId, copyData, song.floatingLayer.startTick);
    result.floatingLayer = undefined;

    return result;
}

export function deleteFloatingLayer(song: Song): Song {
    if (!song.floatingLayer) return song;

    const result = cloneSong(song);
    result.floatingLayer = undefined;

    return result;
}

export function selectionToFloatingLayer(song: Song, trackId: number, selection: WorkspaceSelection): Song {
    const result = applyFloatingLayer(song);
    const copyData = getCopyData(result, trackId, selection);

    result.floatingLayer = {
        events: copyData.events,
        startTick: copyData.startTick,
        endTick: copyData.endTick,
        trackId
    };

    return deleteSelection(result, trackId, selection);
}

export function transposeFloatingLayer(song: Song, deltaNotes: number): Song {
    if (!song.floatingLayer || !deltaNotes) return song;

    const result = cloneSong(song);
    result.floatingLayer.events = result.floatingLayer.events.map(e => ({ ...e, note: e.note + deltaNotes }));

    return result;
}

export function moveFloatingLayer(song: Song, deltaTicks: number): Song {
    if (!song.floatingLayer || !deltaTicks) return song;

    const result = cloneSong(song);
    result.floatingLayer.startTick += deltaTicks;
    result.floatingLayer.endTick += deltaTicks;
    result.floatingLayer.events = result.floatingLayer.events.map(e => ({ ...e, start: e.start + deltaTicks }));

    return result;
}

export function isInSelection(event: NoteEvent, selection: WorkspaceSelection): boolean {
    return event.start >= selection.startTick && event.start + event.duration <= selection.endTick;
}

export function deleteSelection(song: Song, trackId: number, selection: WorkspaceSelection): Song {
    const trackIndex = song.tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) return song;

    const track = song.tracks[trackIndex];

    const updatedTrack: Track = {
        ...track,
        events: track.events.filter(e => !isInSelection(e, selection))
    };

    return updateTrack(updatedTrack, song);
}

export function transposeSelection(song: Song, trackId: number, selection: WorkspaceSelection, deltaNotes: number): Song {
    const trackIndex = song.tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) return song;

    const track = song.tracks[trackIndex];

    const updatedTrack: Track = {
        ...track,
        events: track.events.map(e => {
            if (isInSelection(e, selection)) {
                return { ...e, note: e.note + deltaNotes };
            }
            else {
                return e;
            }
        })
    };

    return updateTrack(updatedTrack, song);
}

export function moveSelection(song: Song, trackId: number, selection: WorkspaceSelection, deltaTicks: number): Song {
    const trackIndex = song.tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) return song;

    const copyData = getCopyData(song, trackId, selection);
    const newSong = deleteSelection(song, trackId, selection);
    return pasteCopyData(newSong, trackId, copyData, selection.startTick + deltaTicks);
}

export function getCopyData(song: Song, trackId: number, selection: WorkspaceSelection): CopyData {
    const track = song.tracks.find(t => t.id === trackId);
    if (!track) return undefined;

    const events = track.events.filter(e => isInSelection(e, selection)).map(e => ({ ...e }));

    return {
        startTick: selection.startTick,
        endTick: selection.endTick,
        events,
        isDrumTrack: isDrumInstrument(song.instruments.find(i => i.id === track.instrumentId))
    };
}

export function pasteCopyData(song: Song, trackId: number, copyData: CopyData, pasteStartTick: number): Song {
    const trackIndex = song.tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) return song;

    const track = song.tracks[trackIndex];

    const maxTicks = song.measures * song.beatsPerMeasure * song.ticksPerBeat;
    const deltaTicks = pasteStartTick - copyData.startTick;
    let selectedEvents = copyData.events.map(e => ({ ...e, start: e.start + deltaTicks, id: track.nextId++ }));
    for (const event of selectedEvents) {
        event.duration = Math.min(event.duration, maxTicks - event.start);
        event.start = Math.max(0, event.start);
    }

    selectedEvents = selectedEvents.filter(e => e.start < maxTicks && e.start + e.duration > 0);

    const resultTrack = { ...song.tracks[trackIndex], events: track.events.map(e => ({ ...e })) };

    for (const selectedEvent of selectedEvents) {
        for (const event of resultTrack.events) {
            if (event.note !== selectedEvent.note) continue;
            if (event.start + event.duration <= selectedEvent.start) continue;
            if (event.start >= selectedEvent.start + selectedEvent.duration) break;

            if (event.start <= selectedEvent.start && event.start + event.duration > selectedEvent.start) {
                event.duration = selectedEvent.start - event.start;
            }
            else if (event.start > selectedEvent.start) {
                event.duration = event.start + event.duration - (selectedEvent.start + selectedEvent.duration);
                event.start = selectedEvent.start + selectedEvent.duration;
            }
        }
    }

    resultTrack.events = resultTrack.events.filter(e => e.duration > 0);

    let pasteIndex = 0;
    for (let i = 0; i < resultTrack.events.length; i++) {
        const toPaste = selectedEvents[pasteIndex];
        if (!toPaste) break;

        if (toPaste.start < resultTrack.events[i].start) {
            resultTrack.events.splice(i, 0, toPaste);
            pasteIndex++;
            i++;
        }
    }

    if (pasteIndex < selectedEvents.length) {
        resultTrack.events.push(...selectedEvents.slice(pasteIndex));
    }

    return updateTrack(resultTrack, song);
}

export function pasteToFloatingLayer(song: Song, trackId: number, copyData: CopyData, pasteStartTick: number): Song {
    const result = cloneSong(song);

    const deltaTicks = pasteStartTick - copyData.startTick;
    const selectedEvents = copyData.events.map(e => ({ ...e, start: e.start + deltaTicks }));

    result.floatingLayer = {
        events: selectedEvents,
        startTick: pasteStartTick,
        endTick: pasteStartTick + (copyData.endTick - copyData.startTick),
        trackId
    };

    return result;
}

function cloneSong(song: Song): Song {
    return {
        ...song,
        tracks: song.tracks.map(t => ({
            ...t,
            events: t.events.map(e => ({ ...e }))
        })),
        floatingLayer: song.floatingLayer ? { ...song.floatingLayer, events: song.floatingLayer.events.map(e => ({ ...e })) } : undefined
    };
}