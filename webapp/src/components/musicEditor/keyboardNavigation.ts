import { isPlaying, startPlaybackAsync, stopPlayback } from "./playback";
import { addNoteToTrack, applySelection, deleteSelectedNotes, editNoteEventLength, findNextNoteEvent, findNoteEventAtTick, findPreviousNoteEvent, findSelectedRange, isBassClefNote, moveSelectedNotes, noteToRow, removeNoteAtRowFromTrack, removeNoteEventFromTrack, removeNoteFromTrack, rowToNote, selectNoteEventsInRange, unselectAllNotes } from "./utils";

/**
 * All shortcuts
 *
 * edit notes:
 *     add note to group at cursor:
 *         a-g
 *     edit note group length
 *         1-9
 *     delete all notes in group:
 *         ctrl + backspace
 *     delete note from group:
 *         backspace
 *     transpose note up:
 *         up
 *     transpose note down:
 *         down
 *     transpose note octave up:
 *         ctrl + up
 *     transpose note octave down:
 *         ctrl + down
 *     change enharmonic spelling:
 *         j
 *
 * select range:
 *     select:
 *         shift + navigation
 *     copy:
 *         ctrl + c
 *     paste:
 *         ctrl + v
 *     cut:
 *         ctrl + x
 *
 *
 * cursor navigation:
 *     next note:
 *         right
 *     previous note:
 *         left
 *     next measure:
 *         ctrl + right
 *     previous measure:
 *         ctrl + left
 *     next note in group:
 *         alt + down
 *     previous note in group:
 *         alt + up
 *     top note in group:
 *         ctrl + alt + up
 *     bottom note in group:
 *         ctrl + alt + down
 *     jump to treble staff:
 *         shift + up
 *     jump to bass staff:
 *         shift + down
 *     jump to start:
 *         ctrl + home
 *     jump to end:
 *         ctrl + end
 *     jump to measure (TODO):
 *         ctrl + f
 *
 * meta:
 *     change grid (TODO):
 *         ???
 *     change track (TODO):
 *         ???
 *
 *
 * playback:
 *     start playback from beginning:
 *         space
 *     start playback from cursor:
 *         shift + space
 *     stop playback:
 *         space (while playing)
 *     loop playback:
 *         ctrl + space
 */

export interface CursorState {
    tick: number;
    track: number;
    gridTicks: number;
    bassClef: boolean;
    hideTracksActive: boolean;
    noteGroupIndex?: number;
    selection?: WorkspaceSelectionState;
}

export function handleKeyboardEvent(song: pxt.assets.music.Song, cursor: CursorState, event: React.KeyboardEvent): [pxt.assets.music.Song, CursorState] {
    const ctrlPressed = event.ctrlKey || event.metaKey;
    const shiftPressed = event.shiftKey;
    const altPressed = event.altKey;

    const noteEventAtCursor = !cursor.selection ? findNoteEventAtTick(song, cursor.track, cursor.tick) : undefined;
    if (noteEventAtCursor?.startTick === cursor.tick && cursor.noteGroupIndex === undefined) {
        cursor.noteGroupIndex = 0;
    }

    let editedSong = song;
    let editedCursor = { ...cursor, selection: cursor.selection && { ...cursor.selection } };

    const instrument = song.tracks[cursor.track].instrument;
    const instrumentOctave = instrument.octave;
    const ticksPerMeasure = song.ticksPerBeat * song.beatsPerMeasure;
    const maxTicks = ticksPerMeasure * song.measures;
    const hasSelection = !!cursor.selection;
    const isDrumTrack = !!song.tracks[cursor.track].drums;

    const clearSelection = (unselectNotes?: boolean) => {
        if (editedCursor.selection) {
            editedSong = applySelection(editedCursor.selection, cursor.hideTracksActive ? cursor.track : undefined);
            if (unselectNotes) {
                editedSong = unselectAllNotes(editedSong);
            }
            delete editedCursor.selection;
        }
    }

    const playNoteEvent = (ev: pxt.assets.music.NoteEvent) => {
        for (const note of ev.notes) {
            pxsim.music.playNoteAsync(note.note, instrument, pxsim.music.tickToMs(editedSong.beatsPerMinute, song.ticksPerBeat, ev.endTick - ev.startTick));
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

            if (editedCursor.selection) {
                editedCursor.selection.transpose++;
                editedSong = applySelection(editedCursor.selection);
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
                let isBass = isBassClefNote(instrumentOctave, note, isDrumTrack);

                const originalRow = noteToRow(instrumentOctave, note, isDrumTrack)

                let row = originalRow;

                const delta = ctrlPressed ? 12 : 1;
                while (noteEventAtCursor.notes.some(n => {
                    if (isBassClefNote(instrumentOctave, n, isDrumTrack) !== isBass) return false;
                    return row === noteToRow(instrumentOctave, n, isDrumTrack)
                })) {
                    row += delta;

                    if (row >= 12) {
                        if (isBass) {
                            isBass = false;
                            row -= 12;
                        }
                        else {
                            break;
                        }
                    }
                }

                if (row >= 12 || row < 0) break;

                const newNote: pxt.assets.music.Note =
                    rowToNote(instrumentOctave, row, isBass, isDrumTrack, note.enharmonicSpelling)

                editedSong = removeNoteAtRowFromTrack(editedSong, cursor.track, originalRow, isBassClefNote(instrumentOctave, note, isDrumTrack), noteEventAtCursor.startTick);
                editedSong = addNoteToTrack(editedSong, cursor.track, newNote, noteEventAtCursor.startTick, noteEventAtCursor.endTick);

                const newEvent = findNoteEventAtTick(editedSong, cursor.track, cursor.tick);
                editedCursor.noteGroupIndex = newEvent.notes.findIndex(n => n.note === newNote.note);

                pxsim.music.playNoteAsync(newNote.note, instrument, pxsim.music.tickToMs(editedSong.beatsPerMinute, song.ticksPerBeat, newEvent.endTick - newEvent.startTick));
            }
            break;

        case "ArrowDown":
        case "Down":
            event.preventDefault();
            if (shiftPressed) {
                editedCursor.bassClef = true;
                break;
            }

            if (editedCursor.selection) {
                editedCursor.selection.transpose--;
                editedSong = applySelection(editedCursor.selection);
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
                const track = editedSong.tracks[cursor.track];
                let isBass = isBassClefNote(instrumentOctave, note, !!track.drums);

                const originalRow = noteToRow(instrumentOctave, note, !!track.drums)

                let row = originalRow;

                const delta = ctrlPressed ? -12 : -1;

                while (noteEventAtCursor.notes.some(n => {
                    if (isBassClefNote(instrumentOctave, n, !!track.drums) !== isBass) return false;
                    return row === noteToRow(instrumentOctave, n, !!track.drums)
                })) {
                    row += delta;

                    if (row < 0) {
                        if (!isBass) {
                            isBass = true;
                            row += 12;
                        }
                        else {
                            break;
                        }
                    }
                }

                if (row >= 12 || row < 0) break;

                const newNote: pxt.assets.music.Note =
                    rowToNote(instrumentOctave, row, isBass, !!track.drums, note.enharmonicSpelling)

                editedSong = removeNoteAtRowFromTrack(editedSong, cursor.track, originalRow, isBassClefNote(instrumentOctave, note, !!track.drums), noteEventAtCursor.startTick);
                editedSong = addNoteToTrack(editedSong, cursor.track, newNote, noteEventAtCursor.startTick, noteEventAtCursor.endTick);

                const newEvent = findNoteEventAtTick(editedSong, cursor.track, cursor.tick);
                editedCursor.noteGroupIndex = newEvent.notes.findIndex(n => n.note === newNote.note);

                pxsim.music.playNoteAsync(newNote.note, instrument, pxsim.music.tickToMs(editedSong.beatsPerMinute, song.ticksPerBeat, newEvent.endTick - newEvent.startTick));            }
            break;

        case "ArrowLeft":
        case "Left":
            event.preventDefault();
            if (shiftPressed && hasSelection && (editedCursor.selection.deltaTick || editedCursor.selection.transpose)) clearSelection(true);
            if (ctrlPressed) {
                if (editedCursor.tick % ticksPerMeasure === 0) {
                    editedCursor.tick = Math.max(editedCursor.tick - ticksPerMeasure, 0);
                }
                else {
                    editedCursor.tick = Math.floor(editedCursor.tick / ticksPerMeasure) * ticksPerMeasure;
                }
                const noteEvent = findNoteEventAtTick(editedSong, cursor.track, editedCursor.tick);
                if (noteEvent?.startTick === editedCursor.tick) {
                    editedCursor.noteGroupIndex = 0;
                    playNoteEvent(noteEvent);
                }
                else {
                    editedCursor.noteGroupIndex = undefined;
                }
                break;
            }

            const prevTick = cursor.tick % cursor.gridTicks !== 0 ? Math.floor(editedCursor.tick / cursor.gridTicks) * cursor.gridTicks: cursor.tick - cursor.gridTicks;

            const prevNoteEvent = findPreviousNoteEvent(editedSong, cursor.track, cursor.tick - 1);
            if (prevNoteEvent?.endTick > prevTick) {
                editedCursor.tick = prevNoteEvent.startTick;
                editedCursor.noteGroupIndex = 0;
                break;
            }

            editedCursor.tick = Math.max(prevTick, 0);
            editedCursor.noteGroupIndex = undefined;
            break;
        case "ArrowRight":
        case "Right":
            event.preventDefault();
            if (shiftPressed && hasSelection && (editedCursor.selection.deltaTick || editedCursor.selection.transpose)) clearSelection(true);
            if (ctrlPressed) {
                if (editedCursor.tick % ticksPerMeasure === 0) {
                    editedCursor.tick = Math.min(editedCursor.tick + ticksPerMeasure, maxTicks - ticksPerMeasure);
                }
                else {
                    editedCursor.tick = Math.min(Math.ceil(editedCursor.tick / ticksPerMeasure) * ticksPerMeasure, maxTicks - ticksPerMeasure);

                    if (editedCursor.tick >= maxTicks) editedCursor.tick -= ticksPerMeasure;
                }

                const noteEvent = findNoteEventAtTick(editedSong, cursor.track, editedCursor.tick);
                if (noteEvent?.startTick === editedCursor.tick) {
                    editedCursor.noteGroupIndex = 0;
                    playNoteEvent(noteEvent);
                }
                else {
                    editedCursor.noteGroupIndex = undefined;
                }
                break;
            }

            const nextTick = noteEventAtCursor ? Math.ceil(noteEventAtCursor.endTick / cursor.gridTicks) * cursor.gridTicks : cursor.tick + cursor.gridTicks;

            const nextNoteEvent = findNextNoteEvent(editedSong, cursor.track, cursor.tick);
            if (nextNoteEvent?.startTick <= nextTick) {
                editedCursor.tick = nextNoteEvent.startTick;
                editedCursor.noteGroupIndex = 0;
                break;
            }

            editedCursor.tick = Math.min(Math.ceil(nextTick / cursor.gridTicks) * cursor.gridTicks, maxTicks - cursor.gridTicks);
            editedCursor.noteGroupIndex = undefined;
            break;
        case "End":
            event.preventDefault();
            if (ctrlPressed) {
                editedCursor.tick = maxTicks - cursor.gridTicks;
                const lastNoteEvent = findNoteEventAtTick(editedSong, cursor.track, editedCursor.tick);
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
                const firstNoteEvent = findNoteEventAtTick(editedSong, cursor.track, editedCursor.tick);
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
            if (cursor.selection) {
                clearSelection();
                editedSong = deleteSelectedNotes(editedSong);
            }
            else if (cursor.noteGroupIndex !== undefined) {
                if (ctrlPressed) {
                    editedSong = removeNoteEventFromTrack(editedSong, cursor.track, cursor.tick);
                    editedCursor.noteGroupIndex = undefined;
                    break;
                }

                editedSong = removeNoteFromTrack(editedSong, cursor.track, noteEventAtCursor.notes[cursor.noteGroupIndex], noteEventAtCursor.startTick);

                if (noteEventAtCursor.notes.length === 1) {
                    editedCursor.noteGroupIndex = undefined;
                }
                else {
                    editedCursor.noteGroupIndex = Math.min(editedCursor.noteGroupIndex, noteEventAtCursor.notes.length - 2);
                }
            }
            break;
        case "Enter":
            if (hasSelection) clearSelection(true);
            break;
        case "Spacebar":
        case " ":
            event.preventDefault();
            if (isPlaying()) {
                stopPlayback();
            }
            else if(shiftPressed) {
                startPlaybackAsync(song, ctrlPressed, cursor?.tick);
            } else {
                startPlaybackAsync(song, ctrlPressed, 0);
            }
            break;
        case "j":
        case "J":
            if (song.tracks[cursor.track].drums) break;

            if (noteEventAtCursor) {
                event.preventDefault();
                const existingNote = noteEventAtCursor.notes[editedCursor.noteGroupIndex]

                const minNote = instrument.octave * 12 - 20;
                const maxNote = instrument.octave * 12 + 20;

                const row = noteToRow(instrumentOctave, existingNote, false);
                const tick = noteEventAtCursor.startTick;
                const bass = isBassClefNote(instrumentOctave, existingNote, false);

                editedSong = removeNoteAtRowFromTrack(editedSong, editedCursor.track, row, bass, tick);

                let newSpelling: "normal" | "sharp" | "flat";
                if (existingNote.enharmonicSpelling === "normal" && existingNote.note < maxNote) {
                    newSpelling = "sharp";
                }
                else if (existingNote.enharmonicSpelling === "sharp" && existingNote.note > minNote || existingNote.note === maxNote) {
                    newSpelling = "flat"
                }
                else {
                    newSpelling = "normal"
                }
                const newNote = rowToNote(instrument.octave, row, bass, false, newSpelling)

                editedSong = addNoteToTrack(
                    editedSong,
                    editedCursor.track,
                    newNote,
                    noteEventAtCursor.startTick,
                    noteEventAtCursor.endTick
                );

                pxsim.music.playNoteAsync(newNote.note, instrument, pxsim.music.tickToMs(editedSong.beatsPerMinute, editedSong.ticksPerBeat, cursor.gridTicks));
            }
            break;
        default:
            if (ctrlPressed && event.key === "a" || event.key === "A") {
                event.preventDefault();
                if (editedCursor.selection) {
                    clearSelection(true);
                }
                editedCursor.selection = {
                    startTick: 0,
                    endTick: maxTicks,
                    originalSong: editedSong,
                    transpose: 0,
                    deltaTick: 0
                }
                break;
            }
            if (/^[a-g]$/i.test(event.key)) {
                if (ctrlPressed) break;
                event.preventDefault();
                clearSelection(true);

                let newNote;

                if (cursor.bassClef) {
                    newNote = rowToNote(instrumentOctave, 3 + "abcdefg".indexOf(event.key.toLowerCase()), true, isDrumTrack);
                }
                else {
                    newNote = rowToNote(instrumentOctave, 5 + "abcdefg".indexOf(event.key.toLowerCase()), false, isDrumTrack);
                }

                if (noteEventAtCursor) {
                    if (noteEventAtCursor.notes.indexOf(newNote) === -1) {
                        editedSong = addNoteToTrack(editedSong, cursor.track, newNote, noteEventAtCursor.startTick, noteEventAtCursor.endTick);
                        const newEvent = findNoteEventAtTick(editedSong, cursor.track, noteEventAtCursor.startTick);
                        playNoteEvent(newEvent);
                    }
                }
                else {
                    editedSong = addNoteToTrack(editedSong, cursor.track, newNote, cursor.tick, cursor.tick + cursor.gridTicks);
                    editedCursor.noteGroupIndex = 0;
                    const newEvent = findNoteEventAtTick(editedSong, cursor.track, cursor.tick);
                    playNoteEvent(newEvent);
                }
                break;
            }
            else if (/^[1-9]$/.test(event.key)) {
                event.preventDefault();
                clearSelection(true);

                if (noteEventAtCursor) {
                    editedSong = editNoteEventLength(editedSong, cursor.track, noteEventAtCursor.startTick, noteEventAtCursor.startTick + parseInt(event.key) * cursor.gridTicks);
                    const newEvent = findNoteEventAtTick(editedSong, cursor.track, noteEventAtCursor.startTick);
                    playNoteEvent(newEvent);
                }
                break;
            }
    }

    if (editedCursor.tick !== cursor.tick) {
        if (shiftPressed) {
            if (!editedCursor.selection) {
                editedCursor.selection = {
                    originalSong: song,
                    startTick: cursor.tick,
                    endTick: editedCursor.tick,
                    transpose: 0,
                    deltaTick: 0
                }
            }
            else {
                editedCursor.selection.endTick = editedCursor.tick;
            }
            editedSong = applySelection(editedCursor.selection, editedCursor.hideTracksActive ? editedCursor.track : undefined);
        }
        else if (editedCursor.selection) {
            const applied = selectNoteEventsInRange(editedCursor.selection.originalSong, editedCursor.selection.startTick, editedCursor.selection.endTick, editedCursor.hideTracksActive ? editedCursor.track : undefined);
            const range = findSelectedRange(applied, editedCursor.gridTicks);

            if (range) {
                editedCursor.selection.startTick = range.start;
                editedCursor.selection.endTick = range.end;
            }

            editedCursor.selection.deltaTick += editedCursor.tick - cursor.tick;
            editedSong = applySelection(editedCursor.selection, editedCursor.hideTracksActive ? editedCursor.track : undefined);

            if (editedCursor.selection.startTick + editedCursor.selection.deltaTick > 0) {
                editedCursor.tick = editedCursor.selection.startTick + editedCursor.selection.deltaTick;
            }
        }
    }

    return [ editedSong, editedCursor ];
}