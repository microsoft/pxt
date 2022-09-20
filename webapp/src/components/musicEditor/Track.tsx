import * as React from "react";
import { NoteGroup } from "./NoteGroup";

export interface TrackProps {
    song: pxt.assets.music.Song;
    track: pxt.assets.music.Track;
}

export const Track = (props: TrackProps) => {
    const { song, track } = props;
    return <g className="music-staff-track">
        {track.notes.map(noteEvent =>
            <NoteGroup
                key={noteEvent.startTick}
                noteEvent={noteEvent}
                song={song}
                iconURI={track.iconURI} />
        )}
    </g>
}