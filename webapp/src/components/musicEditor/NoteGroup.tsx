import * as React from "react";
import { Note } from "./Note";
import { tickToX } from "./svgConstants";
import { noteToRow } from "./utils";

export interface NoteGroupProps {
    song: pxt.assets.music.Song;
    octave: number;
    noteEvent: pxt.assets.music.NoteEvent;
    iconURI: string;
}

export const NoteGroup = (props: NoteGroupProps) => {
    const { song, noteEvent, octave, iconURI } = props;

    const xOffset = tickToX(song, noteEvent.startTick)
    const noteLength = tickToX(song, noteEvent.endTick) - xOffset;

    return <g className="music-staff-note-group" transform={`translate(${xOffset}, 0)`}>
        {noteEvent.notes.map((note, index) =>
            <Note key={index} row={noteToRow(octave, note)} iconURI={iconURI} length={noteLength} />
        )}
    </g>
}