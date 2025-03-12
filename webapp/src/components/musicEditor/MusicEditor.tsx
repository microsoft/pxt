import * as React from "react";
import { EditControls } from "./EditControls";
import { CursorState, handleKeyboardEvent } from "./keyboardNavigation";
import { isPlaying, updatePlaybackSongAsync, stopPlayback } from "./playback";
import { PlaybackControls } from "./PlaybackControls";
import { ScrollableWorkspace } from "./ScrollableWorkspace";
import { GridResolution, TrackSelector } from "./TrackSelector";
import { addNoteToTrack, changeSongLength, editNoteEventLength, fillDrums, findPreviousNoteEvent, findNoteEventAtPosition, findSelectedRange, noteToRow, removeNoteFromTrack, rowToNote, selectNoteEventsInRange, unselectAllNotes, applySelection as applySelectionMove, deleteSelectedNotes, applySelection, removeNoteAtRowFromTrack, isBassClefNote, doesSongUseBassClef, findNoteEventsOverlappingRange } from "./utils";

export interface MusicEditorProps {
    asset: pxt.Song;
    onSongChanged?: (newValue: pxt.assets.music.Song) => void;
    savedUndoStack?: pxt.assets.music.Song[];
    onAssetNameChanged: (newName: string) => void;
    onDoneClicked: () => void;
    editRef: number;
    hideDoneButton?: boolean;
}

interface DragState {
    editing: pxt.assets.music.Song;
    original: pxt.assets.music.Song;

    dragStart?: WorkspaceCoordinate;
    dragEnd?: WorkspaceCoordinate;

    selectionAtDragStart?: WorkspaceSelectionState;

    dragType?: "marquee" | "move" | "note-length";
}

export const MusicEditor = (props: MusicEditorProps) => {
    const { asset, onSongChanged, savedUndoStack, onAssetNameChanged, editRef, onDoneClicked, hideDoneButton} = props;
    const [selectedTrack, setSelectedTrack] = React.useState(0);
    const [gridResolution, setGridResolution] = React.useState<GridResolution>("1/8");
    const [currentSong, setCurrentSong] = React.useState(asset.song);
    const [eraserActive, setEraserActive] = React.useState(false);
    const [hideTracksActive, setHideTracksActive] = React.useState(false);
    const [undoStack, setUndoStack] = React.useState(savedUndoStack || []);
    const [redoStack, setRedoStack] = React.useState<pxt.assets.music.Song[]>([]);
    const [editingId, setEditingId] = React.useState(editRef);
    const [selection, setSelection] = React.useState<WorkspaceSelectionState | undefined>();
    const [cursor, setCursor] = React.useState<CursorState>();
    const [cursorVisible, setCursorVisible] = React.useState(false);
    const [bassClefVisible, setBassClefVisible] = React.useState(doesSongUseBassClef(asset.song));

    React.useEffect(() => {
        return () => {
            stopPlayback();
        }
    }, [])

    React.useEffect(() => {
        const onCopy = (ev: ClipboardEvent) => {
            if (selection) {
                ev.preventDefault();
                ev.stopPropagation();

                ev.clipboardData.setData("application/makecode-song", JSON.stringify(selection))
            }
        }

        const onCut = (ev: ClipboardEvent) => {
            if (selection) {
                ev.preventDefault();
                ev.stopPropagation();

                ev.clipboardData.setData("application/makecode-song", JSON.stringify(selection))

                const updated = applySelection(selection, hideTracksActive ? selectedTrack : undefined);
                updateSong(deleteSelectedNotes(updated), true);
            }
        }

        const onPaste = (ev: ClipboardEvent) => {
            const data = ev.clipboardData.getData("application/makecode-song");

            if (data) {
                const pasted = JSON.parse(data) as WorkspaceSelectionState;

                let newSelection: WorkspaceSelectionState;
                if (selection) {
                    newSelection = {
                        originalSong: unselectAllNotes(applySelection(selection, hideTracksActive ? selectedTrack : undefined)),
                        pastedContent: pasted,
                        startTick: selection.startTick,
                        endTick: selection.startTick + (pasted.endTick - pasted.startTick),
                        deltaTick: 0,
                        transpose: 0
                    };
                }
                else {
                    newSelection = {
                        originalSong: currentSong,
                        pastedContent: pasted,
                        startTick: 0,
                        endTick: pasted.endTick - pasted.startTick,
                        deltaTick: 0,
                        transpose: 0,
                    };
                }

                updateSong(applySelection(newSelection, hideTracksActive ? selectedTrack : undefined), false);
                setSelection(newSelection)
            }
        }

        document.addEventListener("copy", onCopy);
        document.addEventListener("cut", onCut);
        document.addEventListener("paste", onPaste);
        return () => {
            document.removeEventListener("copy", onCopy);
            document.removeEventListener("cut", onCut);
            document.removeEventListener("paste", onPaste);
        }
    }, [selection, hideTracksActive, currentSong])

    if (editingId !== editRef) {
        setEditingId(editRef);
        setCurrentSong(asset.song);
    }

    const dragState = React.useRef<DragState>()

    const gridTicks = eraserActive ? 1 : gridResolutionToTicks(gridResolution, currentSong.ticksPerBeat);
    const isDrumTrack = !!currentSong.tracks[selectedTrack].drums;

    const updateSong = (newSong: pxt.assets.music.Song, pushUndo: boolean) => {
        if (isPlaying()) {
            updatePlaybackSongAsync(newSong);
        }
        let newUndoStack = undoStack.slice()
        if (pushUndo) {
            newUndoStack.push(pxt.assets.music.cloneSong(selection?.originalSong || dragState.current?.original || currentSong));
            setUndoStack(newUndoStack);
            setRedoStack([]);
        }
        setCurrentSong(newSong);
        if (onSongChanged) onSongChanged(newSong);
        if (dragState.current) {
            dragState.current.editing = newSong;
        }
    }

    const clearSelection = () => {
        setSelection(undefined);
        let updated: pxt.assets.music.Song;
        if (dragState?.current?.dragType === "move") {
            updated = unselectAllNotes(dragState.current.editing)
        }
        else if (findSelectedRange(currentSong)) {
            updated = unselectAllNotes(currentSong);
        }

        if (updated) {
            updateSong(updated, true);

            if (dragState?.current?.dragType === "move") {
                dragState.current = undefined;
            }
        }

        return updated;
    }

    const setCursorTick = (tick: number) => {
        if (cursor) {
            setCursor({
                ...cursor,
                tick
            })
        }
        else {
            setCursor({
                tick,
                gridTicks,
                track: selectedTrack,
                bassClef: false,
                hideTracksActive,
                selection
            })
        }
    }

    const onRowClick = (coord: WorkspaceClickCoordinate, ctrlIsPressed: boolean) => {
        setCursorVisible(false);
        const track = currentSong.tracks[selectedTrack];
        const instrument = track.instrument;

        const existingEvent = findPreviousNoteEvent(currentSong, selectedTrack, coord.tick);
        const closestToClickEvent = findPreviousNoteEvent(currentSong, selectedTrack, coord.exactTick);

        clearSelection();
        setCursorTick(coord.tick);

        const isAtCoord = (note: pxt.assets.music.Note) => {
            const isBassClef = isBassClefNote(instrument.octave, note, isDrumTrack);

            if (isBassClef !== coord.isBassClef) return false;

            return noteToRow(instrument.octave, note, isDrumTrack) === coord.row;
        }

        let clickedTick: number;
        let clickedEvent: pxt.assets.music.NoteEvent;

        if (closestToClickEvent?.startTick === coord.exactTick && closestToClickEvent.notes.some(isAtCoord)) {
            clickedTick = coord.exactTick;
            clickedEvent = closestToClickEvent;
        }
        else if (existingEvent?.startTick === coord.tick && existingEvent.notes.some(isAtCoord)) {
            clickedTick = coord.tick;
            clickedEvent = existingEvent;
        }

        if (clickedEvent) {
            const unselected = unselectAllNotes(currentSong);

            if (ctrlIsPressed && !isDrumTrack) {
                // Change the enharmonic spelling
                const existingNote = clickedEvent.notes.find(isAtCoord);

                const minNote = instrument.octave * 12 - 20;
                const maxNote = instrument.octave * 12 + 20;

                const removed = removeNoteAtRowFromTrack(unselected, selectedTrack, coord.row, coord.isBassClef, clickedTick);

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
                const newNote = rowToNote(instrument.octave, coord.row, coord.isBassClef, isDrumTrack, newSpelling)

                updateSong(
                    addNoteToTrack(
                        removed,
                        selectedTrack,
                        newNote,
                        clickedEvent.startTick,
                        clickedEvent.endTick
                    ),
                    true
                );

                pxsim.music.playNoteAsync(newNote.note, instrument, pxsim.music.tickToMs(currentSong.beatsPerMinute, currentSong.ticksPerBeat, clickedEvent.endTick - clickedEvent.startTick))
            }
            else {
                updateSong(
                    removeNoteAtRowFromTrack(unselected, selectedTrack, coord.row, coord.isBassClef, clickedTick),
                    true
                );
            }
        }
        else if (!eraserActive) {
            const note: pxt.assets.music.Note =
                rowToNote(instrument.octave, coord.row, coord.isBassClef, isDrumTrack);

            const maxTick = currentSong.beatsPerMeasure * currentSong.ticksPerBeat * currentSong.measures;

            if (coord.tick === maxTick) return;

            const noteLength = isDrumTrack ? 1 : gridTicks;
            updateSong(unselectAllNotes(addNoteToTrack(currentSong, selectedTrack, note, coord.tick, coord.tick + noteLength)), true)

            if (isDrumTrack) {
                pxsim.music.playDrumAsync(track.drums[note.note]);
            }
            else {
                pxsim.music.playNoteAsync(note.note, instrument, pxsim.music.tickToMs(currentSong.beatsPerMinute, currentSong.ticksPerBeat, gridTicks))
            }
        }
        else {
            for (let i = 0; i < currentSong.tracks.length; i++) {
                if (hideTracksActive && i !== selectedTrack) continue;

                const existingEvent = findPreviousNoteEvent(currentSong, i, coord.tick);
                const closestToClickEvent = findPreviousNoteEvent(currentSong, i, coord.exactTick);

                let clickedTick: number;
                let clickedEvent: pxt.assets.music.NoteEvent;

                if (closestToClickEvent?.startTick === coord.exactTick && closestToClickEvent.notes.some(isAtCoord)) {
                    clickedTick = coord.exactTick;
                    clickedEvent = closestToClickEvent;
                }
                else if (existingEvent?.startTick === coord.tick && existingEvent.notes.some(isAtCoord)) {
                    clickedTick = coord.tick;
                    clickedEvent = existingEvent;
                }

                if (clickedEvent?.startTick === clickedTick || clickedEvent?.endTick > clickedTick) {
                    if (clickedEvent.notes.some(isAtCoord)) {
                        updateSong(removeNoteAtRowFromTrack(currentSong, i, coord.row, coord.isBassClef, clickedEvent.startTick), false);
                    }
                }
            }
            return;
        }
    }

    const onNoteDragStart = () => {
        setCursorVisible(false);
        if (dragState.current) {
            dragState.current.editing = currentSong;
            dragState.current.original = currentSong;
            dragState.current.selectionAtDragStart = selection && { ...selection }
            return;
        }
        dragState.current = {
            editing: currentSong,
            original: currentSong,
            selectionAtDragStart: selection && { ...selection }
        }
    }

    const onNoteDragEnd = () => {
        if (dragState.current.dragType === "move") {
            const dt = dragState.current.dragEnd.tick - dragState.current.dragStart.tick;
            const dr = (dragState.current.dragEnd.row - (dragState.current.dragEnd.isBassClef ? 12 : 0)) - (dragState.current.dragStart.row - (dragState.current.dragStart.isBassClef ? 12 : 0));

            setSelection({
                ...dragState.current.selectionAtDragStart,
                deltaTick: dragState.current.selectionAtDragStart.deltaTick + dt,
                transpose: dragState.current.selectionAtDragStart.transpose + dr
            })

            dragState.current.dragStart = undefined;
            dragState.current.dragEnd = undefined;
            dragState.current.selectionAtDragStart = undefined;
            return;
        }

        if (dragState.current.dragType === "note-length") {
            clearSelection();
        }

        if (!pxt.assets.music.songEquals(dragState.current.editing, dragState.current.original)) {
            updateSong(dragState.current.editing, true);
        }
        if (dragState.current.dragType === "marquee") {
            const selectedRange = findSelectedRange(dragState.current.editing, gridTicks);

            if (selectedRange) {
                setSelection({
                    startTick: selectedRange.start,
                    endTick: selectedRange.end,
                    deltaTick: 0,
                    transpose: 0,
                    originalSong: dragState.current.editing
                })
            }
            else {
                setSelection(undefined);
            }
        }
        dragState.current = undefined;
    }

    const onNoteDrag = (start: WorkspaceClickCoordinate, end: WorkspaceClickCoordinate) => {
        setCursorTick(end.tick);

        // First, check if we are erasing
        if (eraserActive) {
            if (end.row > 11 || end.row < 0) return;
            const prev = dragState.current.dragEnd || end;
            dragState.current.dragEnd = end;

            let editSong = currentSong;
            let didEdit = false;

            // interpolate from previous drag location
            const y0 = (11 - prev.row) + (prev.isBassClef ? 12 : 0);
            const y1 = (11 - end.row) + (end.isBassClef ? 12 : 0);

            pxt.Util.bresenhamLine(
                prev.tick, y0,
                end.tick, y1,
                (tick, y) => {
                    const coord: WorkspaceClickCoordinate = {
                        tick,
                        exactTick: tick,
                        isBassClef: y >= 12,
                        row: 11 - (y % 12)
                    }

                    for (let i = 0; i < currentSong.tracks.length; i++) {
                        if (hideTracksActive && i !== selectedTrack) continue;

                        const track = currentSong.tracks[i];
                        const instrument = track.instrument;
                        const isDrums = !!track.drums;

                        const isAtCoord = (note: pxt.assets.music.Note) => {
                            const isBassClef = isBassClefNote(instrument.octave, note, isDrums);

                            if (isBassClef !== coord.isBassClef) return false;

                            return noteToRow(instrument.octave, note, isDrums) === coord.row;
                        }

                        for (const existingEvent of findNoteEventsOverlappingRange(currentSong, i, coord.exactTick - 1, coord.exactTick + 1)) {
                            if (existingEvent.notes.some(isAtCoord)) {
                                editSong = removeNoteAtRowFromTrack(
                                    editSong,
                                    i,
                                    coord.row,
                                    coord.isBassClef,
                                    existingEvent.startTick
                                )
                                didEdit = true;
                            }
                        }
                    }
                }
            )

            if (didEdit) {
                updateSong(editSong, false);
            }

            return;
        }

        dragState.current.dragType = undefined;
        dragState.current.dragStart = start;
        dragState.current.dragEnd = end;

        if (!!dragState.current.original.tracks[selectedTrack].drums) {
            updateSong(
                fillDrums(
                    dragState.current.original, selectedTrack, start.row, start.isBassClef, start.tick, end.tick, gridTicks
                ),
                false
            );
            return;
        }

        // If we have a selection, check to see if this is dragging the selection around
        if (dragState.current.selectionAtDragStart) {
            const possibleSelection = findNoteEventAtPosition(dragState.current.original, start, hideTracksActive ? selectedTrack : undefined);
            if (possibleSelection?.selected) {

                dragState.current.dragType = "move";
                const dt = end.tick - start.tick;
                const dr = (end.row - (end.isBassClef ? 12 : 0)) - (start.row - (start.isBassClef ? 12 : 0))

                const newSelection = {
                    ...dragState.current.selectionAtDragStart,
                    deltaTick: dt + dragState.current.selectionAtDragStart.deltaTick,
                    transpose: dr + dragState.current.selectionAtDragStart.transpose
                }

                const updated = applySelectionMove(
                    newSelection,
                    hideTracksActive ? selectedTrack : undefined
                );
                updateSong(updated, false);
                setSelection(newSelection);
                return;
            }
        }


        // Next, check if this is a drag to change a note length
        const event = findPreviousNoteEvent(dragState.current.original, selectedTrack, start.exactTick);

        if (!isDrumTrack && event && start.exactTick >= event.startTick && start.exactTick < event.endTick) {
            let isOnRow = false;
            for (const note of event.notes) {
                if (noteToRow(currentSong.tracks[selectedTrack].instrument.octave, note, false) === start.row) {
                    isOnRow = true;
                    break;
                }
            }

            if (isOnRow) {
                if (end.tick < event.startTick + 1) return;

                setSelection(undefined);
                dragState.current.dragType = "note-length";

                updateSong(editNoteEventLength(dragState.current.original, selectedTrack, event.startTick, end.tick), false);
                return;
            }
        }

        // Otherwise, it must be a marquee selection
        setSelection({
            startTick: start.tick,
            endTick: end.tick,
            deltaTick: 0,
            transpose: 0,
            originalSong: dragState.current.editing
        })
        updateSong(selectNoteEventsInRange(dragState.current.original, start.tick, end.tick, hideTracksActive ? selectedTrack : undefined), false);
        dragState.current.dragType = "marquee";
    }

    const onTempoChange = (newTempo: number) => {
        clearSelection();
        setCursorVisible(false);
        updateSong({
            ...currentSong,
            beatsPerMinute: newTempo
        }, true);
    }

    const onMeasuresChanged = (newMeasures: number) => {
        clearSelection();
        setCursorVisible(false);
        updateSong(changeSongLength(currentSong, newMeasures),true);
    }

    const onTrackChanged = (newTrack: number) => {
        clearSelection();
        setCursorVisible(false);
        const t = currentSong.tracks[newTrack];

        if (t.drums) {
            pxsim.music.playDrumAsync(t.drums[0]);
        }
        else {
            pxsim.music.playNoteAsync(rowToNote(t.instrument.octave, 6, false, !!t.drums).note, t.instrument, pxsim.music.tickToMs(currentSong.beatsPerMinute, currentSong.ticksPerBeat, currentSong.ticksPerBeat / 2));
        }
        setSelectedTrack(newTrack);
        if (cursor) setCursor({ ...cursor, track: newTrack });
        if (eraserActive) setEraserActive(false);
    }

    const undo = () => {
        if (!undoStack.length) return;
        setRedoStack(redoStack.concat([currentSong]));
        const toRestore = undoStack.pop();
        setUndoStack(undoStack.slice());
        updateSong(toRestore, false);
    }

    const redo = () => {
        if (!redoStack.length) return;
        setUndoStack(undoStack.concat([currentSong]));
        const toRestore = redoStack.pop();
        setRedoStack(redoStack.slice());
        updateSong(toRestore, false);
    }

    const onEraserClick = () => {
        clearSelection();
        setCursorVisible(false);
        setEraserActive(!eraserActive);
    }

    const onHideTracksClick = () => {
        clearSelection();
        setCursorVisible(false);
        setHideTracksActive(!hideTracksActive);
    }

    const onWorkspaceKeydown = (event: React.KeyboardEvent) => {
        setCursorVisible(true);

        let currentCursor = cursor;
        if (!currentCursor) {
            currentCursor = {
                tick: 0,
                gridTicks,
                track: selectedTrack,
                bassClef: false,
                hideTracksActive,
                selection
            }
        }

        currentCursor.gridTicks = gridTicks;
        currentCursor.track = selectedTrack;
        currentCursor.selection = selection;
        currentCursor.hideTracksActive = hideTracksActive;

        const [ newSong, newCursor ] = handleKeyboardEvent(currentSong, currentCursor, event);

        if (!pxt.assets.music.songEquals(newSong, currentSong)) {
            updateSong(newSong, !newCursor.selection);
        }

        if (newCursor.selection) {
            setSelection(newCursor.selection);
        }
        else {
            setSelection(undefined);
        }
        setCursor(newCursor);
    }

    return <div className="music-editor">
        <TrackSelector
            song={currentSong}
            selected={selectedTrack}
            onTrackSelected={onTrackChanged}
            eraserActive={eraserActive}
            onEraserClick={onEraserClick}
            hideTracksActive={hideTracksActive}
            onHideTracksClick={onHideTracksClick}
            selectedResolution={gridResolution}
            onResolutionSelected={setGridResolution} />
        <ScrollableWorkspace
            song={currentSong}
            selectedTrack={selectedTrack}
            eraserActive={eraserActive}
            onWorkspaceClick={onRowClick}
            onWorkspaceDragStart={onNoteDragStart}
            onWorkspaceDragEnd={onNoteDragEnd}
            onWorkspaceDrag={onNoteDrag}
            gridTicks={gridTicks}
            hideUnselectedTracks={hideTracksActive}
            showBassClef={bassClefVisible}
            selection={selection}
            cursor={cursorVisible ? cursor : undefined}
            onKeydown={onWorkspaceKeydown} />
        <PlaybackControls
            song={currentSong}
            onTempoChange={onTempoChange}
            onMeasuresChanged={onMeasuresChanged}
            onUndoClick={undo}
            onRedoClick={redo}
            showBassClef={bassClefVisible}
            onBassClefCheckboxClick={setBassClefVisible}
            hasUndo={!!undoStack.length}
            hasRedo={!!redoStack.length} />
        <EditControls
            assetName={asset.meta.displayName}
            onAssetNameChanged={onAssetNameChanged}
            onDoneClicked={onDoneClicked}
            hideDoneButton={hideDoneButton}/>
    </div>
}

function gridResolutionToTicks(resolution: GridResolution, ticksPerBeat: number) {
    switch (resolution) {
        case "1/4": return ticksPerBeat;
        case "1/8": return ticksPerBeat / 2;
        case "1/16": return ticksPerBeat / 4;
        case "1/32": return ticksPerBeat / 8;
    }
}