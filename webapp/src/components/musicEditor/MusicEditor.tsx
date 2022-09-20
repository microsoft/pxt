import * as React from "react";
import { EditControls } from "./EditControls";
import { playNoteAsync } from "./playback";
import { PlaybackControls } from "./PlaybackControls";
import { ScrollableWorkspace } from "./ScrollableWorkspace";
import { TrackSelector } from "./TrackSelector";
import { addNoteToTrack } from "./utils";

export interface MusicEditorProps {
    song: pxt.assets.music.Song;

}

export const MusicEditor = (props: MusicEditorProps) => {
    const { song } = props;
    const [selectedTrack, setSelectedTrack] = React.useState(0);
    const [currentSong, setCurrentSong] = React.useState(song);

    const onNoteAdded = (note: number, startTick: number) => {
        const instrument = currentSong.tracks[selectedTrack].instrument
        const adjustedNote = note + instrument.octave * 12
        setCurrentSong(addNoteToTrack(currentSong, selectedTrack, adjustedNote, startTick))
        playNoteAsync(adjustedNote, instrument, 1000)
    }

    return <div>
        <TrackSelector song={currentSong} selected={selectedTrack} onTrackSelected={setSelectedTrack} />
        <ScrollableWorkspace song={currentSong} onWorkspaceClick={onNoteAdded} />
        <PlaybackControls />
        <EditControls />
    </div>
}