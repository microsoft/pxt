import * as React from "react";
import { EditControls } from "./EditControls";
import { isPlaying, playDrumAsync, playNoteAsync, tickToMs, updatePlaybackSongAsync, stopPlayback } from "./playback";
import { PlaybackControls } from "./PlaybackControls";
import { ScrollableWorkspace } from "./ScrollableWorkspace";
import { GridResolution, TrackSelector } from "./TrackSelector";
import { addNoteToTrack, changeSongLength, clearSelection, editNoteEventLength, fillDrums, findClosestPreviousNote, findNoteEventAtPosition, findSelectedRange, moveSelectedNotes, removeNoteFromTrack, rowToNote, selectNoteEventsInRange } from "./utils";

export interface MusicEditorProps {
    asset: pxt.Song;
    onSongChanged?: (newValue: pxt.assets.music.Song) => void;
    savedUndoStack?: pxt.assets.music.Song[];
    onAssetNameChanged: (newName: string) => void;
    onDoneClicked: () => void;
    editRef: number;
}

interface EditSongState {
    editing: pxt.assets.music.Song;
    original: pxt.assets.music.Song;
    isMarqueeSelection: boolean;
}

export const MusicEditor = (props: MusicEditorProps) => {
    const { asset, onSongChanged, savedUndoStack, onAssetNameChanged, editRef, onDoneClicked } = props;
    const [selectedTrack, setSelectedTrack] = React.useState(0);
    const [gridResolution, setGridResolution] = React.useState<GridResolution>("1/8");
    const [currentSong, setCurrentSong] = React.useState(asset.song);
    const [eraserActive, setEraserActive] = React.useState(false);
    const [hideTracksActive, setHideTracksActive] = React.useState(false);
    const [undoStack, setUndoStack] = React.useState(savedUndoStack || []);
    const [redoStack, setRedoStack] = React.useState<pxt.assets.music.Song[]>([]);
    const [editingId, setEditingId] = React.useState(editRef);
    const [selection, setSelection] = React.useState<WorkspaceRange | undefined>();

    React.useEffect(() => {
        return () => {
            stopPlayback();
        }
    }, [])

    if (editingId !== editRef) {
        setEditingId(editRef);
        setCurrentSong(asset.song);
    }

    const editSong = React.useRef<EditSongState>()

    const gridTicks = eraserActive ? 1 : gridResolutionToTicks(gridResolution, currentSong.ticksPerBeat);
    const isDrumTrack = !!currentSong.tracks[selectedTrack].drums;

    const updateSong = (newSong: pxt.assets.music.Song, pushUndo: boolean) => {
        if (isPlaying()) {
            updatePlaybackSongAsync(newSong);
        }
        let newUndoStack = undoStack.slice()
        if (pushUndo) {
            newUndoStack.push(pxt.assets.music.cloneSong(editSong.current?.original || currentSong));
            setUndoStack(newUndoStack);
            setRedoStack([]);
        }
        setCurrentSong(newSong);
        if (onSongChanged) onSongChanged(newSong);
        if (editSong.current) {
            editSong.current.editing = newSong;
        }
    }

    const onRowClick = (coord: WorkspaceCoordinate, ctrlIsPressed: boolean) => {
        const track = currentSong.tracks[selectedTrack];
        const instrument = track.instrument;
        const note = isDrumTrack ? coord.row : rowToNote(instrument.octave, coord.row, coord.isBassClef, ctrlIsPressed);

        const existingEvent = findClosestPreviousNote(currentSong, selectedTrack, coord.tick);

        updateSong(clearSelection(currentSong), true);
        setSelection(undefined);

        if (existingEvent?.startTick === coord.tick && existingEvent.notes.indexOf(note) !== -1) {
            updateSong(removeNoteFromTrack(currentSong, selectedTrack, note, coord.tick), true);
        }
        else if (!eraserActive) {
            const noteLength = isDrumTrack ? 1 : gridTicks;
            updateSong(addNoteToTrack(currentSong, selectedTrack, note, coord.tick, coord.tick + noteLength), true)

            if (isDrumTrack) {
                playDrumAsync(track.drums[note]);
            }
            else {
                playNoteAsync(note, instrument, tickToMs(currentSong.beatsPerMinute, currentSong.ticksPerBeat, gridTicks))
            }
        }
    }

    const onNoteDragStart = () => {
        editSong.current = {
            editing: currentSong,
            original: currentSong,
            isMarqueeSelection: false
        }
    }

    const onNoteDragEnd = () => {
        if (!pxt.assets.music.songEquals(editSong.current.editing, editSong.current.original)) {
            updateSong(editSong.current.editing, true);
        }
        if (editSong.current.isMarqueeSelection) {
            const selectedRange = findSelectedRange(editSong.current.editing, gridTicks);

            if (selectedRange) {
                setSelection({
                    start: {
                        row: 0,
                        isBassClef: false,
                        tick: selectedRange.start,
                    },
                    end: {
                        row: 0,
                        isBassClef: false,
                        tick: selectedRange.end,
                    }
                })
            }
            else {
                setSelection(undefined);
            }
        }
        editSong.current = undefined;
    }

    const onNoteDrag = (start: WorkspaceCoordinate, end: WorkspaceCoordinate) => {
        // First, check if we are erasing
        if (eraserActive) {
            for (let i = 0; i < currentSong.tracks.length; i++) {
                if (hideTracksActive && i !== selectedTrack) continue;

                const track = currentSong.tracks[i];
                const instrument = track.instrument;
                const note = !!track.drums ? end.row : rowToNote(instrument.octave, end.row, end.isBassClef);
                const existingEvent = findClosestPreviousNote(currentSong, i, end.tick);

                if (existingEvent?.startTick === end.tick || existingEvent?.endTick > end.tick) {
                    if (existingEvent.notes.indexOf(note) !== -1) {
                        updateSong(removeNoteFromTrack(currentSong, i, note, existingEvent.startTick), false);
                    }

                    if (track.drums) continue;

                    const sharp = rowToNote(instrument.octave, end.row, end.isBassClef, true);
                    if (existingEvent.notes.indexOf(sharp) !== -1) {
                        updateSong(removeNoteFromTrack(currentSong, i, sharp, existingEvent.startTick), false);
                    }
                }
            }
            return;
        }

        editSong.current.isMarqueeSelection = false;

        if (!!editSong.current.original.tracks[selectedTrack].drums) {
            updateSong(fillDrums(editSong.current.original, selectedTrack, start.row, start.tick, end.tick, gridTicks), false);
            return;
        }

        // If we have a selection, check to see if this is dragging the selection around
        if (selection) {
            const possibleSelection = findNoteEventAtPosition(editSong.current.original, start, hideTracksActive ? selectedTrack : undefined);
            if (possibleSelection?.selected) {
                const dt = end.tick - start.tick;
                const dr = (end.row - (end.isBassClef ? 12 : 0)) - (start.row - (start.isBassClef ? 12 : 0))
                const updated = moveSelectedNotes(editSong.current.original, dt, dr, hideTracksActive ? selectedTrack : undefined)
                updateSong(updated, false);
                const selectedRange = findSelectedRange(updated, gridTicks);

                if (selectedRange) {
                    setSelection({
                        start: {
                            row: 0,
                            isBassClef: false,
                            tick: selectedRange.start,
                        },
                        end: {
                            row: 0,
                            isBassClef: false,
                            tick: selectedRange.end,
                        }
                    })
                }
                else {
                    setSelection(undefined);
                }
                return;
            }
        }

        // Next, check if this is a drag to change a note length
        const event = findClosestPreviousNote(editSong.current.original, selectedTrack, start.tick);

        if (event && start.tick >= event.startTick && start.tick <= event.endTick) {
            if (end.tick < event.startTick + 1) return;

            updateSong(editNoteEventLength(editSong.current.original, selectedTrack, event.startTick, end.tick), false);
            return;
        }

        // Otherwise, it must be a marquee selection
        setSelection({
            start,
            end
        });
        updateSong(selectNoteEventsInRange(editSong.current.original, start.tick, end.tick, hideTracksActive ? selectedTrack : undefined), false);
        editSong.current.isMarqueeSelection = true;
    }

    const onTempoChange = (newTempo: number) => {
        updateSong({
            ...currentSong,
            beatsPerMinute: newTempo
        }, true);
    }

    const onMeasuresChanged = (newMeasures: number) => {
        updateSong(changeSongLength(currentSong, newMeasures),true);
    }

    const onTrackChanged = (newTrack: number) => {
        const t = currentSong.tracks[newTrack];

        if (t.drums) {
            playDrumAsync(t.drums[0]);
        }
        else {
            playNoteAsync(rowToNote(t.instrument.octave, 6, false), t.instrument, tickToMs(currentSong.beatsPerMinute, currentSong.ticksPerBeat, currentSong.ticksPerBeat / 2));
        }
        setSelectedTrack(newTrack);
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
        setEraserActive(!eraserActive);
    }

    const onHideTracksClick = () => {
        setHideTracksActive(!hideTracksActive);
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
            showBassClef={true}
            selection={selection} />
        <PlaybackControls
            song={currentSong}
            onTempoChange={onTempoChange}
            onMeasuresChanged={onMeasuresChanged}
            onUndoClick={undo}
            onRedoClick={redo}
            hasUndo={!!undoStack.length}
            hasRedo={!!redoStack.length} />
        <EditControls
            assetName={asset.meta.displayName}
            onAssetNameChanged={onAssetNameChanged}
            onDoneClicked={onDoneClicked} />
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