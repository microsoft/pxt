import * as React from "react";
import { BEAT_WIDTH, tickToX } from "./svgConstants";
import { findNoteEventAtTick } from "./utils";
import { Workspace, WorkspaceProps } from "./Workspace";

export interface ScrollableWorkspaceProps extends WorkspaceProps {

}

export const ScrollableWorkspace = (props: ScrollableWorkspaceProps) => {
    const { cursor, song } = props;

    const scrollerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!cursor) return;

        const svgOffset = tickToX(song.ticksPerBeat, cursor.tick);
        const svgElement = scrollerRef.current.querySelector("svg") as SVGSVGElement;

        const convertX = (x: number) => {
            const point = svgElement.createSVGPoint();
            point.x = x;
            point.y = 0;
            return point.matrixTransform(svgElement.getScreenCTM()).x;
        }

        const x = convertX(svgOffset);
        const noteEvent = findNoteEventAtTick(song, cursor.track, cursor.tick);

        const beatWidth = convertX(svgOffset + BEAT_WIDTH) - x;;

        let cursorWidth;
        if (noteEvent) {
            cursorWidth = convertX(tickToX(song.ticksPerBeat, noteEvent.endTick + song.ticksPerBeat / 2)) - x;
        }
        else {
            cursorWidth = beatWidth;
        }

        const boundingBox = scrollerRef.current.getBoundingClientRect();

        const leftOffset = x - boundingBox.x;
        const rightOffset = leftOffset + cursorWidth;

        if (leftOffset < beatWidth) {
            scrollerRef.current.scrollLeft += leftOffset - beatWidth;
        }
        else if (cursorWidth < boundingBox.width && rightOffset > boundingBox.width) {
            scrollerRef.current.scrollLeft += rightOffset - boundingBox.width;
        }
    }, [cursor?.tick, song.ticksPerBeat])

    return <div ref={scrollerRef} className="music-scrollable-workspace">
        <div className="music-scroller">
            <Workspace {...props} />
        </div>
    </div>
}