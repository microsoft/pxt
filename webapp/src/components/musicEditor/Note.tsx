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
        { row === 0 &&
            <line
                className="music-staff-row"
                x1={-NOTE_ICON_WIDTH / 2}
                y1={NOTE_ICON_WIDTH / 2}
                x2={NOTE_ICON_WIDTH * 3 / 2}
                y2={NOTE_ICON_WIDTH / 2}
                opacity={opacity} />
        }
        { !!length &&
            <rect
                x={NOTE_ICON_WIDTH / 2}
                y={(NOTE_ICON_WIDTH / 2) - (NOTE_DURATION_HEIGHT / 2)}
                width={length}
                height={NOTE_DURATION_HEIGHT} />
        }
        <image x={0} y={0} width={NOTE_ICON_WIDTH} height={NOTE_ICON_WIDTH} href={iconURI} opacity={opacity}>
            <animate
                attributeName="y"
                values="0;-7;-10;-7;0"
                dur="0.25s"
                repeatCount="1"
                begin="indefinite" />
        </image>
    </g>
}