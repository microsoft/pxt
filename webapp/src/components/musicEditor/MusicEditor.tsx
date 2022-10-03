import * as React from "react";
import { EditControls } from "./EditControls";
import { isPlaying, playDrumAsync, playNoteAsync, tickToMs, updatePlaybackSongAsync } from "./playback";
import { PlaybackControls } from "./PlaybackControls";
import { ScrollableWorkspace } from "./ScrollableWorkspace";
import { GridResolution, TrackSelector } from "./TrackSelector";
import { addNoteToTrack, changeSongLength, editNoteEventLength, fillDrums, findClosestPreviousNote, removeNoteFromTrack, rowToNote } from "./utils";

export interface MusicEditorProps {
    song: pxt.assets.music.Song;
    onSongChanged?: (newValue: pxt.assets.music.Song) => void;
    savedUndoStack?: pxt.assets.music.Song[];
}

export const MusicEditor = (props: MusicEditorProps) => {
    const { song, onSongChanged, savedUndoStack } = props;
    const [selectedTrack, setSelectedTrack] = React.useState(0);
    const [gridResolution, setGridResolution] = React.useState<GridResolution>("1/8");
    const [currentSong, setCurrentSong] = React.useState(song);
    const [undoStack, setUndoStack] = React.useState(savedUndoStack || []);
    const [redoStack, setRedoStack] = React.useState<pxt.assets.music.Song[]>([]);

    const editSong = React.useRef<pxt.assets.music.Song>()

    const gridTicks = gridResolutionToTicks(gridResolution, currentSong.ticksPerBeat);

    const isDrumTrack = !!currentSong.tracks[selectedTrack].drums;

    const updateSong = (newSong: pxt.assets.music.Song, pushUndo: boolean) => {
        if (isPlaying()) {
            updatePlaybackSongAsync(newSong);
        }
        let newUndoStack = undoStack.slice()
        if (pushUndo) {
            newUndoStack.push(pxt.assets.music.cloneSong(currentSong));
            setUndoStack(newUndoStack);
            setRedoStack([]);
        }
        setCurrentSong(newSong);
        if (onSongChanged) onSongChanged(newSong);
    }

    const onRowClick = (row: number, startTick: number, ctrlIsPressed: boolean) => {
        const track = currentSong.tracks[selectedTrack];
        const instrument = track.instrument
        const note = isDrumTrack ? row : rowToNote(instrument.octave, row, ctrlIsPressed);

        const existingEvent = findClosestPreviousNote(currentSong, selectedTrack, startTick);

        if (existingEvent?.startTick === startTick && existingEvent.notes.indexOf(note) !== -1) {
            updateSong(removeNoteFromTrack(currentSong, selectedTrack, note, startTick), true);
        }
        else {
            const noteLength = isDrumTrack ? 1 : gridTicks;
            updateSong(addNoteToTrack(currentSong, selectedTrack, note, startTick, startTick + noteLength), true)

            if (isDrumTrack) {
                playDrumAsync(track.drums[row]);
            }
            else {
                playNoteAsync(note, instrument, tickToMs(currentSong, gridTicks))
            }
        }
    }

    const onNoteDragStart = () => {
        editSong.current = currentSong;
    }

    const onNoteDragEnd = () => {
        if (!pxt.assets.music.songEquals(editSong.current, currentSong)) {
            updateSong(currentSong, true);
        }
        editSong.current = undefined;
    }

    const onNoteDrag = (start: WorkspaceCoordinate, end: WorkspaceCoordinate) => {
        if (!!editSong.current.tracks[selectedTrack].drums) {
            updateSong(fillDrums(editSong.current, selectedTrack, start.row, start.tick, end.tick, gridTicks), false);
        }
        else {
            const event = findClosestPreviousNote(editSong.current, selectedTrack, start.tick);

            if (!event || end.tick < event.startTick + 1) return;

            updateSong(editNoteEventLength(editSong.current, selectedTrack, event.startTick, end.tick), false);
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
            playNoteAsync(rowToNote(t.instrument.octave, 6), t.instrument, tickToMs(currentSong, currentSong.ticksPerBeat / 2));
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

    return <div>
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
            gridTicks={gridTicks} />
        <PlaybackControls
            song={currentSong}
            onTempoChange={onTempoChange}
            onMeasuresChanged={onMeasuresChanged}
            onUndoClick={undo}
            onRedoClick={redo}
            hasUndo={!!undoStack.length}
            hasRedo={!!redoStack.length} />
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