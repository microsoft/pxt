import * as React from "react";
import { classList, clientCoord, screenToSVGCoord } from "../../../../react-common/components/util";
import { Staff } from "./Staff";
import { BASS_STAFF_TOP, closestRow, closestTick, workspaceWidth, WORKSPACE_HEIGHT } from "./svgConstants";
import { Track } from "./Track";
import { findNoteEventAtTick } from "./utils";

export interface WorkspaceProps {
    song: pxt.assets.music.Song;
    onWorkspaceClick: (coordinate: WorkspaceCoordinate, ctrlIsPressed: boolean) => void;
    onWorkspaceDragStart: () => void;
    onWorkspaceDragEnd: () => void;
    onWorkspaceDrag: (startCoordinate: WorkspaceCoordinate, endCoordinate: WorkspaceCoordinate) => void;
    selectedTrack: number
    hideUnselectedTracks: boolean;
    eraserActive: boolean;
    gridTicks?: number;
    showBassClef: boolean;
}

export const Workspace = (props: WorkspaceProps) => {
    const { song, onWorkspaceClick, gridTicks, selectedTrack, onWorkspaceDrag, onWorkspaceDragStart, onWorkspaceDragEnd, hideUnselectedTracks, eraserActive, showBassClef } = props;

    const [cursorLocation, setCursorLocation] = React.useState<WorkspaceCoordinate>(null);
    const [dragStart, setDragStart] = React.useState<WorkspaceCoordinate>(null);
    const [isDragging, setIsDragging] = React.useState(false);

    let workspaceRef: SVGSVGElement;

    React.useEffect(() => {
        workspaceRef.onpointerdown = ev => {
            ev.preventDefault();
            const coord = coordinateToWorkspaceCoordinate(ev, workspaceRef, song, gridTicks);
            if (coord.tick >= 0 && coord.row >= 0 && coord.row < 12) {
                setDragStart(coord);
            }
        };

        workspaceRef.onpointermove = ev => {
            const coord = coordinateToWorkspaceCoordinate(ev, workspaceRef, song, gridTicks);

            if (cursorLocation && cursorLocation.tick === coord.tick && cursorLocation.row === coord.row) return;

            if (coord.tick >= 0 && coord.row >= 0 && coord.row < 12) {
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
                const coord = coordinateToWorkspaceCoordinate(ev, workspaceRef, song, gridTicks);
                if (coord.tick >= 0 && coord.row >= 0 && coord.row < 12) {
                    onWorkspaceClick(coord, ev.ctrlKey);
                }
            }
        };
    }, [cursorLocation, dragStart, isDragging, onWorkspaceDrag, onWorkspaceDragEnd, onWorkspaceDragStart])

    const handleWorkspaceRef = (ref: SVGSVGElement) => {
        if (ref) workspaceRef = ref;
    }

    let cursorPreviewLocation = (isDragging || eraserActive) ? undefined : cursorLocation;
    const eventAtCursor = cursorPreviewLocation ? findNoteEventAtTick(song, selectedTrack, cursorLocation.tick) : undefined;
    if (eventAtCursor) {
        cursorPreviewLocation.tick = eventAtCursor.startTick;
    }

    const inactiveTracks = song.tracks.filter((t, i) => i !== selectedTrack);

    const height = showBassClef ? WORKSPACE_HEIGHT * 2 : WORKSPACE_HEIGHT;

    return <svg
        xmlns="http://www.w3.org/2000/svg"
        className={classList("music-workspace", eraserActive && "erasing")}
        viewBox={`0 0 ${workspaceWidth(song) + 20} ${height}`}
        ref={handleWorkspaceRef}>
        <Staff
            song={song}
            top={0}
            gridTicks={gridTicks} />
        {showBassClef &&
            <Staff
                song={song}
                top={BASS_STAFF_TOP}
                isBassClef={true}
                gridTicks={gridTicks} />
        }
        {!hideUnselectedTracks && inactiveTracks.map((track, index) =>
            <Track
                key={index}
                track={track}
                song={song} />
        )}
        <Track
            track={song.tracks[selectedTrack]}
            song={song}
            cursorLocation={cursorPreviewLocation} />
    </svg>
}

function coordinateToWorkspaceCoordinate(ev: MouseEvent | PointerEvent | TouchEvent, el: SVGSVGElement, song: pxt.assets.music.Song, gridTicks?: number): WorkspaceCoordinate {
    const coord = screenToSVGCoord(el, clientCoord(ev));
    const isBassClef = coord.y > BASS_STAFF_TOP
    const tick = closestTick(song, coord.x, gridTicks);
    const note = closestRow(coord.y);

    return {
        isBassClef,
        row: note,
        tick
    }
}