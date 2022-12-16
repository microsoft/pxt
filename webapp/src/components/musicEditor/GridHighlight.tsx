import { tickToX, STAFF_HEADER_HEIGHT, STAFF_GRID_TICK_HEIGHT, BASS_STAFF_TOP } from "./svgConstants";

export interface GridHighlightProps extends pxt.assets.music.SongInfo {
    gridHighlightStart?: number;
    gridHighlightEnd?: number;
}

export const GridHighlight = (props: GridHighlightProps) => {
    const { gridHighlightStart, gridHighlightEnd, ticksPerBeat } = props;

    const hasGridHighlight = gridHighlightStart != undefined && gridHighlightEnd != undefined;

    if (!hasGridHighlight) return <g/>;

    return <g>
        <rect
            fill="#03adfc"
            x={tickToX(ticksPerBeat, gridHighlightStart)}
            y={STAFF_HEADER_HEIGHT- STAFF_GRID_TICK_HEIGHT}
            width={tickToX(ticksPerBeat, gridHighlightEnd) - tickToX(ticksPerBeat, gridHighlightStart)}
            height={STAFF_GRID_TICK_HEIGHT} />
        <rect
            fill="#03adfc"
            x={tickToX(ticksPerBeat, gridHighlightStart)}
            y={BASS_STAFF_TOP + STAFF_HEADER_HEIGHT- STAFF_GRID_TICK_HEIGHT}
            width={tickToX(ticksPerBeat, gridHighlightEnd) - tickToX(ticksPerBeat, gridHighlightStart)}
            height={STAFF_GRID_TICK_HEIGHT} />
    </g>
}