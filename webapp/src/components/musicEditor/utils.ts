
const staffNoteIntervals = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19];
const bassStaffNoteIntervals = [0, 1, 3, 5, 7, 8, 10, 12, 13, 15, 17, 19];

export function rowToNote(octave: number, row: number, isBassClef: boolean, isDrumTrack: boolean, enharmonicSpelling?: "flat" | "sharp" | "normal"): pxt.assets.music.Note {
    if (isDrumTrack) {
        return {
            note: row + (isBassClef ? 12 : 0),
            enharmonicSpelling: "normal"
        }
    }

    let base: number;

    if (isBassClef) {
        base = bassStaffNoteIntervals[row] + octave * 12 - 19;
    }
    else {
        base = staffNoteIntervals[row] + octave * 12 + 1
    }

    if (!enharmonicSpelling || enharmonicSpelling === "normal") {
        return {
            note: base,
            enharmonicSpelling: "normal"
        };
    }
    else if (enharmonicSpelling === "sharp") {
        return {
            note: base + 1,
            enharmonicSpelling
        }
    }
    else {
        return {
            note: base - 1,
            enharmonicSpelling
        }
    }
}

export function resolveImageURL(path: string) {
    if ((window as any).MonacoPaths) {
        return (window as any).MonacoPaths[path] || path;
    }
    return path;
}

export function noteToRow(octave: number, note: pxt.assets.music.Note, isDrumTrack: boolean) {
    if (isDrumTrack) {
        if (note.note >= 12) return note.note - 12;
        return note.note;
    }
    const isBass = isBassClefNote(octave, note, false);
    const offset = note.note - 1 - octave * 12 + (isBass ? 20 : 0);

    const intervals = isBass ? bassStaffNoteIntervals : staffNoteIntervals;

    for (let i = 0; i < intervals.length; i++) {
        if (intervals[i] === offset) {
            if (note.enharmonicSpelling === "normal") return i;
            else if (note.enharmonicSpelling === "sharp") return i - 1;
            else return i + 1;
        }
        else if (intervals[i] > offset) {
            // must be sharp or flat note
            if (note.enharmonicSpelling === "sharp") return i - 1;
            else if (note.enharmonicSpelling === "flat") return i;
        }
    }

    if (note.enharmonicSpelling === "sharp" && offset === intervals[intervals.length - 1] + 1) {
        return intervals.length - 1;
    }

    return -1;
}

export function isBassClefNote(octave: number, note: pxt.assets.music.Note, isDrumTrack: boolean) {
    if (isDrumTrack) return note.note >= 12;
    if (note.enharmonicSpelling === "flat") {
        return note.note < octave * 12;
    }
    else if (note.enharmonicSpelling === "sharp") {
        return note.note <= octave * 12 + 1
    }
    return note.note < octave * 12 + 1;
}


export function addNoteToTrack(song: pxt.assets.music.Song, trackIndex: number, note: pxt.assets.music.Note, startTick: number, endTick: number) {
    return {
        ...song,
        tracks: song.tracks.map((track, index) => index !== trackIndex ? track : {
            ...track,
            notes: addToNoteArray(track.notes, note, startTick, endTick, track.instrument.octave, !!track.drums)
                .filter(ev => (ev.startTick <= startTick || ev.startTick >= endTick) && (ev.endTick >= endTick || ev.endTick <= startTick))
        })
    }
}

function addToNoteArray(notes: pxt.assets.music.NoteEvent[], note: pxt.assets.music.Note, startTick: number, endTick: number, octave: number, isDrumTrack: boolean) {
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
            if (notes[i].notes.some(n => n.note === note.note && n.enharmonicSpelling === note.enharmonicSpelling)) {
                return notes.slice();
            }

            return notes.map((event, index) => index !== i ? event : {
                ...event,
                notes: event.notes.concat([note]).sort((a, b) => {
                    const aIsBassClef = isBassClefNote(octave, a, isDrumTrack);
                    const bIsBassClef = isBassClefNote(octave, b, isDrumTrack);

                    if (aIsBassClef === bIsBassClef) return noteToRow(octave, a, isDrumTrack) - noteToRow(octave, b, isDrumTrack);
                    else if (aIsBassClef) return -1;
                    else return 1;
                })
            })
        }
    }
    return notes.slice().concat([noteEvent]);
}


export function removeNoteFromTrack(song: pxt.assets.music.Song, trackIndex: number, note: pxt.assets.music.Note, startTick: number) {
    return {
        ...song,
        tracks: song.tracks.map((track, index) => index !== trackIndex ? track : {
            ...track,
            notes: removeNoteFromNoteArray(track.notes, note, startTick)
        })
    }
}

function removeNoteFromNoteArray(notes: pxt.assets.music.NoteEvent[], note: pxt.assets.music.Note, startTick: number) {
    const res = notes.slice();

    for (let i = 0; i < res.length; i++) {
        if (res[i].startTick == startTick) {
            res[i] = {
                ...res[i],
                notes: res[i].notes.filter(n => n.note !== note.note)
            }
            break;
        }
    }
    return res.filter(e => e.notes.length);
}

export function removeNoteAtRowFromTrack(song: pxt.assets.music.Song, trackIndex: number, row: number, isBassClef: boolean, startTick: number) {
    return {
        ...song,
        tracks: song.tracks.map((track, index) => index !== trackIndex ? track : {
            ...track,
            notes: removeNoteAtRowFromNoteArray(track.notes, row, isBassClef, track.instrument.octave, startTick, !!track.drums)
        })
    }
}

function removeNoteAtRowFromNoteArray(notes: pxt.assets.music.NoteEvent[], row: number, isBassClef: boolean, octave: number, startTick: number, isDrumTrack: boolean) {
    const res = notes.slice();

    for (let i = 0; i < res.length; i++) {
        if (res[i].startTick == startTick) {
            res[i] = {
                ...res[i],
                notes: res[i].notes.filter(n =>{
                    return isBassClefNote(octave, n, isDrumTrack) !== isBassClef ||
                        noteToRow(octave, n, isDrumTrack) !== row;
                })
            }
            break;
        }
    }
    return res.filter(e => e.notes.length);
}

export function removeNoteEventFromTrack(song: pxt.assets.music.Song, trackIndex: number, startTick: number) {
    return {
        ...song,
        tracks: song.tracks.map((track, index) => index !== trackIndex ? track : {
            ...track,
            notes: track.notes.filter(n => n.startTick !== startTick)
        })
    }
}

export function editNoteEventLength(song: pxt.assets.music.Song, trackIndex: number, startTick: number, endTick: number) {
    const maxTick = song.beatsPerMeasure * song.ticksPerBeat * song.measures;

    return {
        ...song,
        tracks: song.tracks.map((track, index) => index !== trackIndex ? track : {
            ...track,
            notes: setNoteEventLength(track.notes, startTick, Math.min(endTick, maxTick))
        })
    }
}

function setNoteEventLength(notes: pxt.assets.music.NoteEvent[], startTick: number, endTick: number) {
    const res = notes.slice();
    if (startTick >= endTick) return res;

    let newNoteEvent: pxt.assets.music.NoteEvent;

    for (let i = 0; i < res.length; i++) {
        if (res[i].startTick === startTick) {
            newNoteEvent = {
                ...res[i],
                endTick: endTick
            }
            res[i] = newNoteEvent
        }
        else if (newNoteEvent && res[i].startTick < newNoteEvent.endTick) {
            res[i] = undefined;
        }
    }
    return res.filter(e => !!e);
}

export function fillDrums(song: pxt.assets.music.Song, trackIndex: number, row: number, isBassClef: boolean, startTick: number, endTick: number, tickSpacing: number) {
    const note = rowToNote(0, row, isBassClef, true);
    for (let i = startTick; i < endTick; i += tickSpacing) {
        song = addNoteToTrack(song, trackIndex, { note: note.note, enharmonicSpelling: "normal" }, i, i + 1)
    }
    return song;
}

export function findNoteEventAtTick(song: pxt.assets.music.Song, trackIndex: number, tick: number) {
    const track = song.tracks[trackIndex];

    for (const note of track.notes) {
        if (note.startTick <= tick && note.endTick > tick) {
            return note;
        }
    }

    return undefined;
}

export function findPreviousNoteEvent(song: pxt.assets.music.Song, trackIndex: number, tick: number) {
    const track = song.tracks[trackIndex];

    let lastNote: pxt.assets.music.NoteEvent;
    for (const note of track.notes) {
        if (note.startTick > tick) {
            return lastNote;
        }
        lastNote = note;
    }

    return lastNote;
}

export function findNoteEventsOverlappingRange(song: pxt.assets.music.Song, trackIndex: number, startTick: number, endTick: number) {
    const track = song.tracks[trackIndex];

    const result: pxt.assets.music.NoteEvent[] = [];
    for (const note of track.notes) {
        if (!(note.endTick < startTick || note.startTick > endTick)) {
            result.push(note);
        }
        else if (note.startTick > endTick) {
            break;
        }
    }

    return result;
}

export function findNextNoteEvent(song: pxt.assets.music.Song, trackIndex: number, tick: number) {
    const track = song.tracks[trackIndex];

    for (const note of track.notes) {
        if (note.startTick > tick) {
            return note;
        }
    }

    return undefined;
}

export function findNoteEventAtPosition(song: pxt.assets.music.Song, position: WorkspaceCoordinate, trackIndex?: number) {
    if (trackIndex !== undefined) {
        const event = findNoteEventAtTick(song, trackIndex, position.tick);

        const track = song.tracks[trackIndex];

        if (event?.notes.some(n => noteToRow(track.instrument.octave, n, !!track.drums) === position.row)) {
            return event;
        }
        return undefined;
    }

    for (let i = 0; i < song.tracks.length; i++) {
        const event = findNoteEventAtTick(song, i, position.tick);

        const track = song.tracks[i];

        if (event?.notes.some(n => noteToRow(track.instrument.octave, n, !!track.drums) === position.row)) {
            return event;
        }
    }

    return undefined;
}


export function changeSongLength(song: pxt.assets.music.Song, measures: number) {
    const maxTick = measures * song.beatsPerMeasure * song.ticksPerBeat;

    return {
        ...song,
        measures,
        tracks: song.tracks.map(t => {
            const res = {
                ...t,
                notes: t.notes.slice()
            }


            res.notes = res.notes.filter(e => e.startTick < maxTick);
            res.notes = res.notes.map(e => ({
                ...e,
                endTick: Math.min(e.endTick, maxTick)
            }));

            return res;
        })
    }
}

export function findSelectedRange(song: pxt.assets.music.Song, gridTicks?: number) {
    let start = song.measures * song.beatsPerMeasure * song.ticksPerBeat + 1;
    let end = -1;

    for (const track of song.tracks) {
        for (const note of track.notes) {
            if (note.selected) {
                start = Math.min(note.startTick, start);
                end = Math.max(note.endTick, end);
            }
        }
    }

    if (end === -1) return undefined;

    if (gridTicks !== undefined) {
        start = Math.floor(start / gridTicks) * gridTicks;
        end = Math.ceil(end / gridTicks) * gridTicks;
    }

    return {
        start,
        end
    }
}

export function selectNoteEventsInRange(song: pxt.assets.music.Song, startTick: number, endTick: number, trackIndex?: number): pxt.assets.music.Song {
    if (trackIndex !== undefined) {
        return {
            ...song,
            tracks: song.tracks.map((t, i) => i !== trackIndex ? t : selectTrackNoteEventsInRange(t, Math.min(startTick, endTick), Math.max(startTick, endTick)))
        }
    }
    return {
        ...song,
        tracks: song.tracks.map(t => selectTrackNoteEventsInRange(t, Math.min(startTick, endTick), Math.max(startTick, endTick)))
    }
}

function selectTrackNoteEventsInRange(track: pxt.assets.music.Track, startTick: number, endTick: number): pxt.assets.music.Track {
    return {
        ...track,
        notes: track.notes.map(e => ({
            ...e,
            notes: e.notes.slice(),
            selected: !(e.startTick >= endTick || e.endTick <= startTick)
        }))
    }
}

export function unselectAllNotes(song: pxt.assets.music.Song): pxt.assets.music.Song {
    return {
        ...song,
        tracks: song.tracks.map(t => ({
            ...t,
            notes: t.notes.map(n => ({
                ...n,
                selected: false
            }))
        }))
    }
}

export function deleteSelectedNotes(song: pxt.assets.music.Song): pxt.assets.music.Song {
    return {
        ...song,
        tracks: song.tracks.map(t => ({
            ...t,
            notes: t.notes.filter(n => !n.selected)
        }))
    }
}

export function moveSelectedNotes(song: pxt.assets.music.Song, deltaTicks: number, deltaRows: number, trackIndex?: number): pxt.assets.music.Song {
    const range = findSelectedRange(song);

    if (!range) return song;

    const { start, end } = range;

    const newStart = start + deltaTicks;
    const newEnd = end + deltaTicks;
    const maxTick = song.beatsPerMeasure * song.ticksPerBeat * song.measures;

    return {
        ...song,
        tracks: song.tracks.map((t, i) => (trackIndex !== undefined && trackIndex != i) ? t : ({
            ...t,
            notes: t.notes
                .filter(n => n.selected || n.endTick <= newStart || n.startTick >= newEnd)
                .map(n => !n.selected ? n : moveNoteEvent(n, t.instrument.octave, deltaTicks, deltaRows, !!t.drums))
                .map(n => ({ ...n, endTick: Math.min(n.endTick, maxTick) }))
                .filter(n => n.notes.length > 0 && n.startTick >= 0 && n.startTick < maxTick)
                .sort((a, b) => a.startTick - b.startTick)
        }))
    }
}

export function applySelection(selection: WorkspaceSelectionState, trackIndex?: number) {
    if (selection.pastedContent) {
        return pasteNotes(selection, trackIndex);
    }

    const selected = selectNoteEventsInRange(selection.originalSong, selection.startTick, selection.endTick, trackIndex);
    return moveSelectedNotes(selected, selection.deltaTick, selection.transpose, trackIndex);
}

function pasteNotes(selection: WorkspaceSelectionState, trackIndex?: number): pxt.assets.music.Song {
    const toPaste = applySelection(selection.pastedContent, trackIndex);
    const sourceRange = findSelectedRange(toPaste, trackIndex);

    const pasteStart = selection.startTick + selection.deltaTick;
    const pasteEnd = pasteStart + (sourceRange.end - sourceRange.start);

    const song = unselectAllNotes(selection.originalSong);
    const maxTick = song.beatsPerMeasure * song.ticksPerBeat * song.measures;

    return {
        ...song,
        tracks: song.tracks.map((t, i) => (trackIndex !== undefined && trackIndex != i) ? t : ({
            ...t,
            notes: t.notes
                .filter(n => n.endTick <= pasteStart || n.startTick >= pasteEnd)
                .concat(
                    toPaste.tracks[i].notes
                        .filter(n => n.selected)
                        .map(n => ({...n, startTick: n.startTick - sourceRange.start + selection.startTick, endTick: n.endTick - sourceRange.start + selection.startTick}))
                )
                .map(n => !n.selected ? n : moveNoteEvent(n, t.instrument.octave, selection.deltaTick, selection.transpose, !!t.drums))
                .map(n => ({ ...n, endTick: Math.min(n.endTick, maxTick) }))
                .filter(n => n.notes.length > 0 && n.startTick >= 0 && n.startTick < maxTick)
                .sort((a, b) => a.startTick - b.startTick)
        }))
    }
}

function moveNoteEvent(noteEvent: pxt.assets.music.NoteEvent, trackOctave: number, deltaTicks: number, deltaRows: number, isDrumTrack: boolean) {
    const res: pxt.assets.music.NoteEvent = {
        ...noteEvent,
        startTick: noteEvent.startTick + deltaTicks,
        endTick: noteEvent.endTick + deltaTicks,
        notes: []
    }

    if (isDrumTrack) {
        // Don't transpose drum rows since it would completely change the sounds
        res.notes = noteEvent.notes.slice();
    }
    else {
        for (const note of noteEvent.notes) {
            let isBass = isBassClefNote(trackOctave, note, isDrumTrack);
            let row = noteToRow(trackOctave, note, isDrumTrack);

            if (row + deltaRows >= staffNoteIntervals.length) {
                if (isBass) {
                    row -= 12;
                    isBass = false;
                }
            }
            else if (row + deltaRows < 0) {
                if (!isBass) {
                    row += 12;
                    isBass = true
                }
            }

            const newRow = row + deltaRows;

            if (newRow < 0 || newRow >= staffNoteIntervals.length) {
                // drop notes that are no longer visible on the staff
                continue;
            }

            res.notes.push(rowToNote(trackOctave, newRow, isBass, isDrumTrack, note.enharmonicSpelling));
        }
    }

    return res;
}

export function doesSongUseBassClef(song: pxt.assets.music.Song) {
    return song.tracks.some(track =>
        track.notes.some(noteEvent =>
            noteEvent.notes.some(note =>
                isBassClefNote(track.instrument.octave, note, !!track.drums)
            )
        )
    );
}