import * as React from "react";
import { EditControls } from "./EditControls";
import { playNoteAsync } from "./playback";
import { PlaybackControls } from "./PlaybackControls";
import { ScrollableWorkspace } from "./ScrollableWorkspace";
import { GridResolution, TrackSelector } from "./TrackSelector";
import { addNoteToTrack } from "./utils";

export interface MusicEditorProps {
    song: pxt.assets.music.Song;

}

export const MusicEditor = (props: MusicEditorProps) => {
    const { song } = props;
    const [selectedTrack, setSelectedTrack] = React.useState(0);
    const [gridResolution, setGridResolution] = React.useState<GridResolution>("1/8");
    const [currentSong, setCurrentSong] = React.useState(song);

    const onNoteAdded = (note: number, startTick: number) => {
        const instrument = currentSong.tracks[selectedTrack].instrument
        const adjustedNote = note + instrument.octave * 12
        setCurrentSong(addNoteToTrack(currentSong, selectedTrack, adjustedNote, startTick))
        playNoteAsync(adjustedNote, instrument, 1000)
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
            onWorkspaceClick={onNoteAdded}
            gridTicks={gridResolutionToTicks(gridResolution, song.ticksPerBeat)} />
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