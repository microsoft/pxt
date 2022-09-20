import * as React from "react";
import { Workspace, WorkspaceProps } from "./Workspace";

export interface ScrollableWorkspaceProps extends WorkspaceProps {

}

export const ScrollableWorkspace = (props: ScrollableWorkspaceProps) => {
    return <div className="music-scrollable-workspace">
        <div className="music-scroller">
            <Workspace {...props} />
        </div>
    </div>
}