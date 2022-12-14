import * as React from "react";
import { EditControls } from "./EditControls";
import { isPlaying, playDrumAsync, playNoteAsync, tickToMs, updatePlaybackSongAsync, stopPlayback } from "./playback";
import { PlaybackControls } from "./PlaybackControls";
import { ScrollableWorkspace } from "./ScrollableWorkspace";
import { GridResolution, TrackSelector } from "./TrackSelector";
import { addNoteToTrack, changeSongLength, editNoteEventLength, fillDrums, findClosestPreviousNote, removeNoteFromTrack, rowToNote } from "./utils";

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
                playNoteAsync(note, instrument, tickToMs(currentSong, gridTicks))
            }
        }
    }

    const onNoteDragStart = () => {
        editSong.current = {
            editing: currentSong,
            original: currentSong
        }
    }

    const onNoteDragEnd = () => {
        if (!pxt.assets.music.songEquals(editSong.current.editing, editSong.current.original)) {
            updateSong(editSong.current.editing, true);
        }
        editSong.current = undefined;
    }

    const onNoteDrag = (start: WorkspaceCoordinate, end: WorkspaceCoordinate) => {
        if (eraserActive) {
            for (let i = 0; i < currentSong.tracks.length; i++) {
                if (hideTracksActive && i !== selectedTrack) continue;

                const track = currentSong.tracks[i];
                const instrument = track.instrument;
                const note = !!track.drums ? end.row : rowToNote(instrument.octave, end.row, false);
                const existingEvent = findClosestPreviousNote(currentSong, i, end.tick);

                if (existingEvent?.startTick === end.tick && existingEvent.notes.indexOf(note) !== -1) {
                    updateSong(removeNoteFromTrack(currentSong, i, note, end.tick), false);
                }
            }
            return;
        }

        if (!!editSong.current.original.tracks[selectedTrack].drums) {
            updateSong(fillDrums(editSong.current.original, selectedTrack, start.row, start.tick, end.tick, gridTicks), false);
        }
        else {
            const event = findClosestPreviousNote(editSong.current.original, selectedTrack, start.tick);

            if (!event || end.tick < event.startTick + 1) return;

            updateSong(editNoteEventLength(editSong.current.original, selectedTrack, event.startTick, end.tick), false);
        }
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
            playNoteAsync(rowToNote(t.instrument.octave, 6, false), t.instrument, tickToMs(currentSong, currentSong.ticksPerBeat / 2));
        }
        setSelectedTrack(newTrack);
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
            selectedResolution={gridResolution}
            onResolutionSelected={setGridResolution} />
        <ScrollableWorkspace
            song={currentSong}
            selectedTrack={selectedTrack}
            onWorkspaceClick={onRowClick}
            onWorkspaceDragStart={onNoteDragStart}
            onWorkspaceDragEnd={onNoteDragEnd}
            onWorkspaceDrag={onNoteDrag}
            gridTicks={gridTicks}
            hideUnselectedTracks={hideTracksActive} />
        <PlaybackControls
            song={currentSong}
            onTempoChange={onTempoChange}
            onMeasuresChanged={onMeasuresChanged}
            eraserActive={eraserActive}
            onEraserClick={onEraserClick} />
        <EditControls
            hideTracksActive={hideTracksActive}
            onHideTracksClick={onHideTracksClick}
            onUndoClick={undo}
            onRedoClick={redo}
            hasUndo={!!undoStack.length}
            hasRedo={!!redoStack.length}
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