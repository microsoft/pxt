import * as React from "react";
import { clientCoord, screenToSVGCoord } from "../../../../react-common/components/util";
import { Staff } from "./Staff";
import { closestNote, closestTick, workspaceWidth, WORKSPACE_HEIGHT } from "./svgConstants";
import { Track } from "./Track";

export interface WorkspaceProps {
    song: pxt.assets.music.Song;
    onWorkspaceClick: (note: number, tick: number) => void;
    gridTicks?: number;
}

export const Workspace = (props: WorkspaceProps) => {
    const { song, onWorkspaceClick, gridTicks } = props;

    const handleWorkspaceClick = (ev: React.MouseEvent<SVGSVGElement>) => {
        const coord = screenToSVGCoord(ev.currentTarget, clientCoord(ev.nativeEvent));
        const tick = closestTick(song, coord.x, gridTicks);
        const note = closestNote(coord.y);

        if (tick > 0 && note > 0 && note < 12) {
            onWorkspaceClick(note, tick);
        }
    }

    return <svg
        xmlns="http://www.w3.org/2000/svg"
        className="music-workspace"
        viewBox={`0 0 ${workspaceWidth(song)} ${WORKSPACE_HEIGHT}`}
        onClick={handleWorkspaceClick}>
        <Staff song={song} />
        {song.tracks.map((track, index) =>
            <Track key={index} track={track} song={song} />
        )}
    </svg>
}