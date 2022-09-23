import * as React from "react";
import { EditControls } from "./EditControls";
import { isPlaying, playDrumAsync, playNoteAsync, tickToMs, updatePlaybackSongAsync } from "./playback";
import { PlaybackControls } from "./PlaybackControls";
import { ScrollableWorkspace } from "./ScrollableWorkspace";
import { GridResolution, TrackSelector } from "./TrackSelector";
import { addNoteToTrack, changeSongLength, editNoteEventLength, fillDrums, findClosestPreviousNote, removeNoteFromTrack, rowToNote } from "./utils";

export interface MusicEditorProps {
    song: pxt.assets.music.Song;
}

export const MusicEditor = (props: MusicEditorProps) => {
    const { song } = props;
    const [selectedTrack, setSelectedTrack] = React.useState(0);
    const [gridResolution, setGridResolution] = React.useState<GridResolution>("1/8");
    const [currentSong, setCurrentSong] = React.useState(song);
    const editSong = React.useRef<pxt.assets.music.Song>()

    const gridTicks = gridResolutionToTicks(gridResolution, currentSong.ticksPerBeat);

    const isDrumTrack = !!currentSong.tracks[selectedTrack].drums;

    const updateSong = (newSong: pxt.assets.music.Song) => {
        if (isPlaying()) {
            updatePlaybackSongAsync(newSong);
        }
        setCurrentSong(newSong);
    }

    const onRowClick = (row: number, startTick: number) => {
        const track = currentSong.tracks[selectedTrack];
        const instrument = track.instrument
        const note = isDrumTrack ? row : rowToNote(instrument.octave, row);

        const existingEvent = findClosestPreviousNote(currentSong, selectedTrack, startTick);

        if (existingEvent?.startTick === startTick && existingEvent.notes.indexOf(note) !== -1) {
            updateSong(removeNoteFromTrack(currentSong, selectedTrack, note, startTick));
        }
        else {
            const noteLength = isDrumTrack ? 1 : gridTicks;
            updateSong(addNoteToTrack(currentSong, selectedTrack, note, startTick, startTick + noteLength))

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
        editSong.current = undefined;
    }

    const onNoteDrag = (start: WorkspaceCoordinate, end: WorkspaceCoordinate) => {
        if (!!editSong.current.tracks[selectedTrack].drums) {
            updateSong(fillDrums(editSong.current, selectedTrack, start.row, start.tick, end.tick, gridTicks));
        }
        else {
            const event = findClosestPreviousNote(editSong.current, selectedTrack, start.tick);

            if (!event || end.tick < event.startTick + 1) return;

            updateSong(editNoteEventLength(editSong.current, selectedTrack, event.startTick, end.tick));
        }
    }

    const onTempoChange = (newTempo: number) => {
        updateSong({
            ...currentSong,
            beatsPerMinute: newTempo
        });
    }

    const onMeasuresChanged = (newMeasures: number) => {
        updateSong(changeSongLength(currentSong, newMeasures));
    }

    return <div>
        <TrackSelector
            song={currentSong}
            selected={selectedTrack}
            onTrackSelected={setSelectedTrack}
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
            onMeasuresChanged={onMeasuresChanged} />
        <EditControls />
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