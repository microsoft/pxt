import * as React from "react";
import { rowY, NOTE_DURATION_HEIGHT, NOTE_ICON_WIDTH } from "./svgConstants";

export interface NoteProps {
    row: number;
    iconURI: string
    length?: number;
    opacity?: number;
}

export const Note = (props: NoteProps) => {
    const { row, iconURI, length, opacity } = props;

    return <g className="music-staff-note" transform={`translate(${-(NOTE_ICON_WIDTH / 2)}, ${rowY(row) - (NOTE_ICON_WIDTH / 2)})`}>
        { !!length &&
            <rect
                x={NOTE_ICON_WIDTH / 2}
                y={(NOTE_ICON_WIDTH / 2) - (NOTE_DURATION_HEIGHT / 2)}
                width={length}
                height={NOTE_DURATION_HEIGHT} />
        }
        <image width={NOTE_ICON_WIDTH} height={NOTE_ICON_WIDTH} href={iconURI} opacity={opacity} />
    </g>
}