import * as React from "react";
import { clientCoord, screenToSVGCoord } from "../../../../react-common/components/util";
import { Staff } from "./Staff";
import { closestRow, closestTick, workspaceWidth, WORKSPACE_HEIGHT } from "./svgConstants";
import { Track } from "./Track";
import { findNoteEventAtTick } from "./utils";

export interface WorkspaceProps {
    song: pxt.assets.music.Song;
    onWorkspaceClick: (note: number, tick: number) => void;
    onWorkspaceDragStart: () => void;
    onWorkspaceDragEnd: () => void;
    onWorkspaceDrag: (startCoordinate: WorkspaceCoordinate, endCoordinate: WorkspaceCoordinate) => void;
    selectedTrack: number
    gridTicks?: number;
}

export const Workspace = (props: WorkspaceProps) => {
    const { song, onWorkspaceClick, gridTicks, selectedTrack, onWorkspaceDrag, onWorkspaceDragStart, onWorkspaceDragEnd } = props;

    const [cursorLocation, setCursorLocation] = React.useState<WorkspaceCoordinate>(null);
    const [dragStart, setDragStart] = React.useState<WorkspaceCoordinate>(null);
    const [isDragging, setIsDragging] = React.useState(false);

    let workspaceRef: SVGSVGElement;

    React.useEffect(() => {
        workspaceRef.onpointerdown = ev => {
            ev.preventDefault();
            const coord = coordinateToWorkspaceCoordinate(ev, workspaceRef, song, gridTicks);
            if (coord.tick > 0 && coord.row > 0 && coord.row < 12) {
                setDragStart(coord);
            }
        };

        workspaceRef.onpointermove = ev => {
            const coord = coordinateToWorkspaceCoordinate(ev, workspaceRef, song, gridTicks);

            if (cursorLocation && cursorLocation.tick === coord.tick && cursorLocation.row === coord.row) return;

            if (coord.tick > 0 && coord.row > 0 && coord.row < 12) {
                if (dragStart) {
                    if (!isDragging) {
                        setIsDragging(true);
                        onWorkspaceDragStart();
                    }
                    onWorkspaceDrag(dragStart, coord);
                }
                setCursorLocation(coord);
            }
            else {
                setCursorLocation(null);
            }
        };

        workspaceRef.onpointerleave = ev => {
            setCursorLocation(null);
            if (isDragging) {
                onWorkspaceDragEnd();
                setIsDragging(false);
            }
        };

        workspaceRef.onpointerup = ev => {
            setDragStart(null);
            if (isDragging) {
                onWorkspaceDragEnd();
                setIsDragging(false);
            }
            else {
                const { row: note, tick } = coordinateToWorkspaceCoordinate(ev, workspaceRef, song, gridTicks);
                if (tick >= 0 && note > 0 && note < 12) {
                    onWorkspaceClick(note, tick);
                }
            }
        };
    }, [cursorLocation, dragStart, isDragging, onWorkspaceDrag, onWorkspaceDragEnd, onWorkspaceDragStart])

    const handleWorkspaceRef = (ref: SVGSVGElement) => {
        if (ref) workspaceRef = ref;
    }

    let cursorPreviewLocation = isDragging ? undefined : cursorLocation;
    const eventAtCursor = cursorPreviewLocation ? findNoteEventAtTick(song, selectedTrack, cursorLocation.tick) : undefined;
    if (eventAtCursor) {
        cursorPreviewLocation.tick = eventAtCursor.startTick;
    }

    return <svg
        xmlns="http://www.w3.org/2000/svg"
        className="music-workspace"
        viewBox={`0 0 ${workspaceWidth(song)} ${WORKSPACE_HEIGHT}`}
        ref={handleWorkspaceRef}>
        <Staff song={song} />
        {song.tracks.map((track, index) =>
            <Track
                key={index}
                track={track}
                song={song}
                cursorLocation={index === selectedTrack ? cursorPreviewLocation : undefined} />
        )}
    </svg>
}

function coordinateToWorkspaceCoordinate(ev: MouseEvent | PointerEvent | TouchEvent, el: SVGSVGElement, song: pxt.assets.music.Song, gridTicks?: number): WorkspaceCoordinate {
    const coord = screenToSVGCoord(el, clientCoord(ev));
    const tick = closestTick(song, coord.x, gridTicks);
    const note = closestRow(coord.y);

    return {
        row: note,
        tick
    }
}