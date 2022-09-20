import * as React from "react";
import { Workspace } from "./Workspace";

export interface ScrollableWorkspaceProps {
    song: pxt.assets.music.Song;
    onWorkspaceClick: (note: number, tick: number) => void;
}

export const ScrollableWorkspace = (props: ScrollableWorkspaceProps) => {
    const { song, onWorkspaceClick } = props;

    return <div className="music-scrollable-workspace">
        <div className="music-scroller">
            <Workspace song={song} onWorkspaceClick={onWorkspaceClick} />
        </div>
    </div>
}