import * as React from "react";
import { noteY, NOTE_ICON_WIDTH } from "./svgConstants";

export interface NoteProps {
    note: number;
    iconURI: string
}

export const Note = (props: NoteProps) => {
    const { note, iconURI } = props;

    return <g className="music-staff-note" transform={`translate(${-(NOTE_ICON_WIDTH / 2)}, ${noteY(note) - (NOTE_ICON_WIDTH / 2)})`}>
        <rect width={NOTE_ICON_WIDTH} height={NOTE_ICON_WIDTH} opacity={0} />
        <image width={NOTE_ICON_WIDTH} height={NOTE_ICON_WIDTH} href={iconURI} />
    </g>
}