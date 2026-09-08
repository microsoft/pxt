import * as React from "react";
import { CursorState } from "./keyboardNavigation";
import { NoteGroup } from "./NoteGroup";
import { BASS_STAFF_TOP, STAFF_HEADER_HEIGHT, tickToX, WORKSPACE_HEIGHT } from "./svgConstants";

export interface TrackProps {
    song: pxt.assets.music.Song;
    track: pxt.assets.music.Track;
    keyboardCursor?: CursorState;
}

export const Track = (props: TrackProps) => {
    const { song, track, keyboardCursor } = props;

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
                key={noteEventKey(noteEvent)}
                noteEvent={noteEvent}
                octave={track.instrument.octave}
                song={song}
                iconURI={track.iconURI}
                isDrumTrack={!!track.drums}
                cursor={keyboardCursor} />
        )}
    </g>
}

const noteEventKey = (noteEvent: pxt.assets.music.NoteEvent) => `${noteEvent.startTick}-${noteEvent.endTick}-${noteEvent.notes.map(n => n.note + n.enharmonicSpelling).join("-")}`;