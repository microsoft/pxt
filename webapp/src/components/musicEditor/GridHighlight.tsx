import { tickToX, STAFF_HEADER_HEIGHT, STAFF_GRID_TICK_HEIGHT, BASS_STAFF_TOP } from "./svgConstants";

export interface GridHighlightProps extends pxt.assets.music.SongInfo {
    start?: number;
    end?: number;
}

export const GridHighlight = (props: GridHighlightProps) => {
    const { start, end, ticksPerBeat } = props;

    const hasGridHighlight = start != undefined && end != undefined;

    if (!hasGridHighlight) return <g/>;

    return <g>
        <rect
            fill="#03adfc"
            x={tickToX(ticksPerBeat, start)}
            y={STAFF_HEADER_HEIGHT - STAFF_GRID_TICK_HEIGHT}
            width={tickToX(ticksPerBeat, end) - tickToX(ticksPerBeat, start)}
            height={STAFF_GRID_TICK_HEIGHT} />
        <rect
            fill="#03adfc"
            x={tickToX(ticksPerBeat, start)}
            y={BASS_STAFF_TOP + STAFF_HEADER_HEIGHT- STAFF_GRID_TICK_HEIGHT}
            width={tickToX(ticksPerBeat, end) - tickToX(ticksPerBeat, start)}
            height={STAFF_GRID_TICK_HEIGHT} />
    </g>
}