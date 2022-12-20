import { playNoteAsync, tickToMs } from "./playback";
import { addNoteToTrack, editNoteEventLength, findNoteEventAtTick, removeNoteEventFromTrack, removeNoteFromTrack, rowToNote } from "./utils";

export interface CursorState {
    tick: number;
    track: number;
    gridTicks: number;
    bassClef: boolean;
    noteGroupIndex?: number;
}

export function handleKeyboardEvent(song: pxt.assets.music.Song, cursor: CursorState, event: React.KeyboardEvent): [pxt.assets.music.Song, CursorState] {
    const ctrlPressed = event.ctrlKey || event.metaKey;
    const shiftPressed = event.shiftKey;
    const altPressed = event.altKey;

    const noteEventAtCursor = findNoteEventAtTick(song, cursor.track, cursor.tick);
    if (noteEventAtCursor?.startTick === cursor.tick && cursor.noteGroupIndex === undefined) {
        cursor.noteGroupIndex = 0;
    }

    let editedSong = song;
    let editedCursor = { ...cursor };

    const instrument = song.tracks[cursor.track].instrument;
    const instrumentOctave = instrument.octave;
    const drums = song.tracks[cursor.track].drums;
    const minNote = drums ? 0 : instrumentOctave * 12 - 20;
    const maxNote = drums ? drums.length - 1 : instrumentOctave * 12 + 19;
    const ticksPerMeasure = song.ticksPerBeat * song.beatsPerMeasure;
    const maxTicks = ticksPerMeasure * song.measures;

    const playNoteEvent = (ev: pxt.assets.music.NoteEvent) => {
        for (const note of ev.notes) {
            playNoteAsync(note, instrument, tickToMs(song.beatsPerMinute, song.ticksPerBeat, ev.endTick - ev.startTick));
        }
    }


    switch (event.key) {
        case "ArrowUp":
        case "Up":
            event.preventDefault();
            if (shiftPressed) {
                editedCursor.bassClef = false;
                break;
            }
            if (!noteEventAtCursor) break;
            if (altPressed && ctrlPressed) {
                editedCursor.noteGroupIndex = noteEventAtCursor.notes.length - 1;
            }
            else if (altPressed) {
                editedCursor.noteGroupIndex = Math.min(cursor.noteGroupIndex + 1, noteEventAtCursor.notes.length - 1);
            }
            else {
                let note = noteEventAtCursor.notes[cursor.noteGroupIndex];

                while (noteEventAtCursor.notes.indexOf(note) !== -1) {
                    note++;
                }
                if (note < minNote || note > maxNote) {
                    break;
                }


                editedSong = removeNoteFromTrack(song, cursor.track, noteEventAtCursor.notes[cursor.noteGroupIndex], noteEventAtCursor.startTick);
                editedSong = addNoteToTrack(editedSong, cursor.track, note, noteEventAtCursor.startTick, noteEventAtCursor.endTick);

                const newEvent = findNoteEventAtTick(editedSong, cursor.track, cursor.tick);
                editedCursor.noteGroupIndex = newEvent.notes.indexOf(note);

                playNoteAsync(note, instrument, tickToMs(song.beatsPerMinute, song.ticksPerBeat, newEvent.endTick - newEvent.startTick));
            }
            break;

        case "ArrowDown":
        case "Down":
            event.preventDefault();
            if (shiftPressed) {
                editedCursor.bassClef = true;
                break;
            }
            if (!noteEventAtCursor) break;
            if (altPressed && ctrlPressed) {
                editedCursor.noteGroupIndex = 0;
            }
            else if (altPressed) {
                editedCursor.noteGroupIndex = Math.max(cursor.noteGroupIndex - 1, 0);
            }
            else {
                let note = noteEventAtCursor.notes[cursor.noteGroupIndex];

                while (noteEventAtCursor.notes.indexOf(note) !== -1) {
                    note--;
                }
                if (note < minNote || note > maxNote) {
                    break;
                }

                editedSong = removeNoteFromTrack(song, cursor.track, noteEventAtCursor.notes[cursor.noteGroupIndex], noteEventAtCursor.startTick);
                editedSong = addNoteToTrack(editedSong, cursor.track, note, noteEventAtCursor.startTick, noteEventAtCursor.endTick);

                const newEvent = findNoteEventAtTick(editedSong, cursor.track, cursor.tick);
                editedCursor.noteGroupIndex = newEvent.notes.indexOf(note);

                playNoteAsync(note, instrument, tickToMs(song.beatsPerMinute, song.ticksPerBeat, newEvent.endTick - newEvent.startTick));
            }
            break;

        case "ArrowLeft":
        case "Left":
            event.preventDefault();
            if (ctrlPressed) {
                if (editedCursor.tick % ticksPerMeasure === 0) {
                    editedCursor.tick = Math.max(editedCursor.tick - ticksPerMeasure, 0);
                }
                else {
                    editedCursor.tick = Math.floor(editedCursor.tick / ticksPerMeasure) * ticksPerMeasure;
                }
                const noteEvent = findNoteEventAtTick(song, cursor.track, editedCursor.tick);
                if (noteEvent?.startTick === editedCursor.tick) {
                    editedCursor.noteGroupIndex = 0;
                    playNoteEvent(noteEvent);
                }
                else {
                    editedCursor.noteGroupIndex = undefined;
                }
                break;
            }

            const prevNoteEvent = findNoteEventAtTick(song, cursor.track, cursor.tick - cursor.gridTicks);
            if (prevNoteEvent) {
                editedCursor.tick = prevNoteEvent.startTick;
                editedCursor.noteGroupIndex = 0;
                break;
            }

            editedCursor.tick = Math.max(editedCursor.tick - cursor.gridTicks, 0);
            editedCursor.noteGroupIndex = undefined;
            break;
        case "ArrowRight":
        case "Right":
            event.preventDefault();
            if (ctrlPressed) {
                if (editedCursor.tick % ticksPerMeasure === 0) {
                    editedCursor.tick = Math.min(editedCursor.tick - ticksPerMeasure, maxTicks - ticksPerMeasure);
                }
                else {
                    editedCursor.tick = Math.min(Math.ceil(editedCursor.tick / ticksPerMeasure) * ticksPerMeasure, maxTicks - ticksPerMeasure);

                    if (editedCursor.tick >= maxTicks) editedCursor.tick -= ticksPerMeasure;
                }
                const noteEvent = findNoteEventAtTick(song, cursor.track, editedCursor.tick);
                if (noteEvent?.startTick === editedCursor.tick) {
                    editedCursor.noteGroupIndex = 0;
                    playNoteEvent(noteEvent);
                }
                else {
                    editedCursor.noteGroupIndex = undefined;
                }
                break;
            }

            const nextNoteEvent = findNoteEventAtTick(song, cursor.track, cursor.tick + cursor.gridTicks);
            if (nextNoteEvent) {
                editedCursor.tick = nextNoteEvent.startTick;
                editedCursor.noteGroupIndex = 0;
                break;
            }

            editedCursor.tick = Math.min(editedCursor.tick + cursor.gridTicks, maxTicks - cursor.gridTicks);
            editedCursor.noteGroupIndex = undefined;
            break;
        case "End":
            event.preventDefault();
            if (ctrlPressed) {
                editedCursor.tick = maxTicks - cursor.gridTicks;
                const lastNoteEvent = findNoteEventAtTick(song, cursor.track, editedCursor.tick);
                if (lastNoteEvent) {
                    editedCursor.tick = lastNoteEvent.startTick;
                    editedCursor.noteGroupIndex = 0;
                    playNoteEvent(lastNoteEvent);
                }
                else {
                    editedCursor.noteGroupIndex = undefined;
                }
            }
            break;
        case "Home":
            event.preventDefault();
            if (ctrlPressed) {
                editedCursor.tick = 0;
                const firstNoteEvent = findNoteEventAtTick(song, cursor.track, editedCursor.tick);
                if (firstNoteEvent) {
                    editedCursor.noteGroupIndex = 0;
                    playNoteEvent(firstNoteEvent);
                }
                else {
                    editedCursor.noteGroupIndex = undefined;
                }
            }
            break;
        case "Backspace":
            event.preventDefault();
            if (cursor.noteGroupIndex !== undefined) {
                if (ctrlPressed) {
                    editedSong = removeNoteEventFromTrack(song, cursor.track, cursor.tick);
                    editedCursor.noteGroupIndex = undefined;
                    break;
                }

                editedSong = removeNoteFromTrack(song, cursor.track, noteEventAtCursor.notes[cursor.noteGroupIndex], noteEventAtCursor.startTick);

                if (noteEventAtCursor.notes.length === 1) {
                    editedCursor.noteGroupIndex = undefined;
                }
                else {
                    editedCursor.noteGroupIndex = Math.min(editedCursor.noteGroupIndex, noteEventAtCursor.notes.length - 2);
                }
            }
            break;
        default:
            if (/^[a-g]$/i.test(event.key)) {
                event.preventDefault();
                const newNote = rowToNote(instrumentOctave, 5 + "abcdefg".indexOf(event.key.toLowerCase()), cursor.bassClef);
                if (noteEventAtCursor) {
                    if (noteEventAtCursor.notes.indexOf(newNote) === -1) {
                        editedSong = addNoteToTrack(song, cursor.track, newNote, noteEventAtCursor.startTick, noteEventAtCursor.endTick);
                        const newEvent = findNoteEventAtTick(editedSong, cursor.track, noteEventAtCursor.startTick);
                        playNoteEvent(newEvent);
                    }
                }
                else {
                    editedSong = addNoteToTrack(song, cursor.track, newNote, cursor.tick, cursor.tick + cursor.gridTicks);
                    editedCursor.noteGroupIndex = 0;
                    const newEvent = findNoteEventAtTick(editedSong, cursor.track, cursor.tick);
                    playNoteEvent(newEvent);
                }
                break;
            }
            else if (/^[1-9]$/.test(event.key)) {
                event.preventDefault();
                if (noteEventAtCursor) {
                    editedSong = editNoteEventLength(song, cursor.track, noteEventAtCursor.startTick, noteEventAtCursor.startTick + parseInt(event.key) * cursor.gridTicks);
                    const newEvent = findNoteEventAtTick(editedSong, cursor.track, noteEventAtCursor.startTick);
                    playNoteEvent(newEvent);
                }
                break;
            }
    }

    return [ editedSong, editedCursor ];
}