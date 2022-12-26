import { tickToX, STAFF_HEADER_HEIGHT, BASS_STAFF_TOP, WORKSPACE_HEIGHT } from "./svgConstants";

export interface WorkspaceSelectionProps extends pxt.assets.music.SongInfo {
    range: WorkspaceSelectionState;
}

export const WorkspaceSelection = (props: WorkspaceSelectionProps) => {
    const { range, ticksPerBeat } = props;

    const x0 = tickToX(ticksPerBeat, range.startTick + range.deltaTick);
    const x1 = tickToX(ticksPerBeat, range.endTick + range.deltaTick);

    return <g>
        <rect
            className="music-workspace-selection"
            fill="#03adfc"
            opacity={0.5}
            x={Math.min(x0, x1)}
            y={STAFF_HEADER_HEIGHT}
            width={Math.max(x0, x1) - Math.min(x0, x1)}
            height={WORKSPACE_HEIGHT - STAFF_HEADER_HEIGHT} />

        <rect
            className="music-workspace-selection"
            fill="#03adfc"
            opacity={0.5}
            x={Math.min(x0, x1)}
            y={BASS_STAFF_TOP + STAFF_HEADER_HEIGHT}
            width={Math.max(x0, x1) - Math.min(x0, x1)}
            height={WORKSPACE_HEIGHT - STAFF_HEADER_HEIGHT} />

    </g>
}