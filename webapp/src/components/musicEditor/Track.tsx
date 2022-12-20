import * as React from "react";
import { CursorState } from "./keyboardNavigation";
import { Note } from "./Note";
import { NoteGroup } from "./NoteGroup";
import { BASS_STAFF_TOP, STAFF_HEADER_HEIGHT, tickToX, WORKSPACE_HEIGHT } from "./svgConstants";

export interface TrackProps {
    song: pxt.assets.music.Song;
    track: pxt.assets.music.Track;
    keyboardCursor?: CursorState;
    cursorLocation?: WorkspaceCoordinate;
}

export const Track = (props: TrackProps) => {
    const { song, track, cursorLocation, keyboardCursor } = props;

    let cursorElement: JSX.Element;
    if (cursorLocation) {
        cursorElement = <g transform={`translate(${tickToX(song.ticksPerBeat, cursorLocation.tick)}, 0)`}>
            <Note
                isBassClef={cursorLocation.isBassClef}
                row={cursorLocation.row}
                iconURI={track.iconURI}
                opacity={0.5} />
        </g>
    }

    return <g className="music-staff-track">
        {keyboardCursor &&
            <g>
                <rect
                    x={tickToX(song.ticksPerBeat, keyboardCursor.tick)}
                    y={keyboardCursor.bassClef ? BASS_STAFF_TOP + STAFF_HEADER_HEIGHT : STAFF_HEADER_HEIGHT}
                    width={5}
                    height={WORKSPACE_HEIGHT - STAFF_HEADER_HEIGHT}
                    fill="purple"
                />
            </g>
        }
        {track.notes.map(noteEvent =>
            <NoteGroup
                key={noteEvent.startTick}
                noteEvent={noteEvent}
                octave={track.instrument.octave}
                song={song}
                iconURI={track.iconURI}
                isDrumTrack={!!track.drums}
                cursor={keyboardCursor} />
        )}
        { cursorElement }
    </g>
}