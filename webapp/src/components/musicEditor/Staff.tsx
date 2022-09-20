import * as React from "react";
import { classList } from "../../../../react-common/components/util";
import { beatToX, CLEF_HEIGHT, noteY, STAFF_HEADER_FONT_SIZE, STAFF_HEADER_HEIGHT, STAFF_HEADER_OFFSET, workspaceWidth, WORKSPACE_HEIGHT } from "./svgConstants";

export interface StaffProps {
    song: pxt.assets.music.Song;
}

export const Staff = (props: StaffProps) => {
    const { song } = props;

    const totalWidth = workspaceWidth(song)

    const rows: JSX.Element[] = [];
    for (let i = 0; i < 5; i++) {
        rows.push(
            <line
                key={i}
                className="music-staff-row"
                x1={0}
                y1={noteY(i * 2 + 2)}
                x2={totalWidth}
                y2={noteY(i * 2 + 2)} />
        )
    }

    const beats: JSX.Element[] = [];
    for (let i = 0; i < song.measures * song.beatsPerMeasure; i++) {
        beats.push(
            <g key={i}>
                {i % song.beatsPerMeasure === 0 &&
                    <text
                        x={beatToX(i)}
                        y={STAFF_HEADER_HEIGHT - STAFF_HEADER_OFFSET}
                        text-anchor="middle"
                        fontSize={STAFF_HEADER_FONT_SIZE}>
                        {Math.floor(i / song.beatsPerMeasure) + 1}
                    </text>
                }
                <line
                    className={classList("music-staff-beat", i % song.beatsPerMeasure === 0 && "measure-start")}
                    x1={beatToX(i)}
                    y1={STAFF_HEADER_HEIGHT}
                    x2={beatToX(i)}
                    y2={WORKSPACE_HEIGHT} />
            </g>
        )
    }

    return <g className="music-staff">
        <rect
            className="music-staff-background"
            x={0}
            y={STAFF_HEADER_HEIGHT}
            width={totalWidth}
            height={WORKSPACE_HEIGHT - STAFF_HEADER_HEIGHT}
            />
        <image
            className="music-staff-clef"
            href="/static/music-editor/treble-clef.svg"
            height={CLEF_HEIGHT}
            y={STAFF_HEADER_HEIGHT}  />
        <g className="music-staff-rows">
            { rows }
        </g>
        <g className="music-staff-beats">
             {beats }
        </g>
    </g>
}