import * as React from "react";
import { EditControls } from "./EditControls";
import { playNoteAsync } from "./playback";
import { PlaybackControls } from "./PlaybackControls";
import { ScrollableWorkspace } from "./ScrollableWorkspace";
import { GridResolution, TrackSelector } from "./TrackSelector";
import { addNoteToTrack, editNoteEventLength, findClosestPreviousNote, removeNoteFromTrack } from "./utils";

export interface MusicEditorProps {
    song: pxt.assets.music.Song;

}

export const MusicEditor = (props: MusicEditorProps) => {
    const { song } = props;
    const [selectedTrack, setSelectedTrack] = React.useState(0);
    const [gridResolution, setGridResolution] = React.useState<GridResolution>("1/8");
    const [currentSong, setCurrentSong] = React.useState(song);
    const editSong = React.useRef<pxt.assets.music.Song>()

    const onNoteClick = (note: number, startTick: number) => {
        const instrument = currentSong.tracks[selectedTrack].instrument
        const adjustedNote = note + instrument.octave * 12;


        const existingEvent = findClosestPreviousNote(currentSong, selectedTrack, startTick);

        if (existingEvent?.startTick === startTick && existingEvent.notes.indexOf(adjustedNote) !== -1) {
            setCurrentSong(removeNoteFromTrack(currentSong, selectedTrack, adjustedNote, startTick));
        }
        else {
            setCurrentSong(addNoteToTrack(currentSong, selectedTrack, adjustedNote, startTick, startTick + gridResolutionToTicks(gridResolution, currentSong.ticksPerBeat)))
            playNoteAsync(adjustedNote, instrument, 1000)
        }
    }

    const onNoteDragStart = () => {
        editSong.current = currentSong;
    }

    const onNoteDragEnd = () => {
        editSong.current = undefined;
    }

    const onNoteDrag = (start: WorkspaceCoordinate, end: WorkspaceCoordinate) => {
        const event = findClosestPreviousNote(editSong.current, selectedTrack, start.tick);

        if (!event || end.tick < event.startTick + 1) return;

        setCurrentSong(editNoteEventLength(editSong.current, selectedTrack, event.startTick, end.tick));
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
            onWorkspaceClick={onNoteClick}
            onWorkspaceDragStart={onNoteDragStart}
            onWorkspaceDragEnd={onNoteDragEnd}
            onWorkspaceDrag={onNoteDrag}
            gridTicks={gridResolutionToTicks(gridResolution, currentSong.ticksPerBeat)} />
        <PlaybackControls song={currentSong} />
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