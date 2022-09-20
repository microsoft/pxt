import * as React from "react";
import { Note } from "./Note";
import { tickToX } from "./svgConstants";

export interface NoteGroupProps {
    song: pxt.assets.music.Song;
    noteEvent: pxt.assets.music.NoteEvent;
    iconURI: string;
}

export const NoteGroup = (props: NoteGroupProps) => {
    const { song, noteEvent, iconURI } = props;

    const xOffset = tickToX(song, noteEvent.startTick)

    return <g className="music-staff-note-group" transform={`translate(${xOffset}, 0)`}>
        {noteEvent.notes.map((note, index) =>
            <Note key={index} note={note} iconURI={iconURI} />
        )}
    </g>
}