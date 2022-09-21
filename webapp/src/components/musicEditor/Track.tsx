import * as React from "react";
import { Note } from "./Note";
import { NoteGroup } from "./NoteGroup";
import { tickToX } from "./svgConstants";

export interface TrackProps {
    song: pxt.assets.music.Song;
    track: pxt.assets.music.Track;
    cursorLocation?: WorkspaceCoordinate;
}

export const Track = (props: TrackProps) => {
    const { song, track, cursorLocation } = props;

    let cursorElement: JSX.Element;
    if (cursorLocation) {
        cursorElement = <g transform={`translate(${tickToX(song, cursorLocation.tick)}, 0)`}>
            <Note
                row={cursorLocation.row}
                iconURI={track.iconURI}
                opacity={0.5} />
        </g>
    }

    return <g className="music-staff-track">
        {track.notes.map(noteEvent =>
            <NoteGroup
                key={noteEvent.startTick}
                noteEvent={noteEvent}
                octave={track.instrument.octave}
                song={song}
                iconURI={track.iconURI} />
        )}
        { cursorElement }
    </g>
}