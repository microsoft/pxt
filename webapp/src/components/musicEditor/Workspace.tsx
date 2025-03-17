import * as React from "react";
import { classList, clientCoord, screenToSVGCoord } from "../../../../react-common/components/util";
import { GridHighlight } from "./GridHighlight";
import { CursorState } from "./keyboardNavigation";
import { Staff } from "./Staff";
import { BASS_STAFF_TOP, BEAT_WIDTH, closestRow, closestTick, workspaceWidth, WORKSPACE_HEIGHT } from "./svgConstants";
import { Track } from "./Track";
import { findNoteEventAtTick } from "./utils";
import { WorkspaceSelection } from "./WorkspaceSelection";

export interface WorkspaceProps {
    song: pxt.assets.music.Song;
    onWorkspaceClick: (coordinate: WorkspaceClickCoordinate, ctrlIsPressed: boolean) => void;
    onWorkspaceDragStart: () => void;
    onWorkspaceDragEnd: () => void;
    onWorkspaceDrag: (startCoordinate: WorkspaceClickCoordinate, endCoordinate: WorkspaceClickCoordinate) => void;
    onKeydown: (event: React.KeyboardEvent) => void;
    cursor: CursorState;
    selectedTrack: number
    hideUnselectedTracks: boolean;
    eraserActive: boolean;
    gridTicks?: number;
    showBassClef: boolean;
    selection?: WorkspaceSelectionState;
}

export const Workspace = (props: WorkspaceProps) => {
    const { song, onWorkspaceClick, gridTicks, selectedTrack, onWorkspaceDrag, onWorkspaceDragStart, onWorkspaceDragEnd, onKeydown, cursor, hideUnselectedTracks, eraserActive, showBassClef, selection } = props;

    const [cursorLocation, setCursorLocation] = React.useState<WorkspaceClickCoordinate>(null);
    const [dragStart, setDragStart] = React.useState<WorkspaceClickCoordinate>(null);
    const [isDragging, setIsDragging] = React.useState(false);

    let workspaceRef: SVGSVGElement;

    React.useEffect(() => {
        workspaceRef.onpointerdown = ev => {
            ev.preventDefault();
            workspaceRef.focus();
            const coord = coordinateToWorkspaceCoordinate(ev, workspaceRef, song, gridTicks);
            if (eraserActive || coord.tick >= 0 && coord.row >= 0 && coord.row < 12) {
                setDragStart(coord);
            }
        };

        workspaceRef.onpointermove = ev => {
            const coord = coordinateToWorkspaceCoordinate(ev, workspaceRef, song, gridTicks);

            if (cursorLocation && cursorLocation.exactTick === coord.exactTick && cursorLocation.row === coord.row) return;

            const maxTick = song.beatsPerMeasure * song.ticksPerBeat * song.measures;

            if (coord.tick >= 0 && coord.row >= 0 && coord.row < 12 && coord.tick <= maxTick) {
                if (dragStart) {
                    if (!isDragging) {
                        setIsDragging(true);
                        onWorkspaceDragStart();
                        onWorkspaceDrag(dragStart, dragStart);
                    }
                    onWorkspaceDrag(dragStart, coord);
                }

                // We don't show the cursor on the last tick, since you can't place notes there.
                // Events still fire, though, because you need to be able to drag note lengths to the end
                if (coord.tick < maxTick) {
                    setCursorLocation(coord);
                }
                else {
                    setCursorLocation(null);
                }
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
            const coord = coordinateToWorkspaceCoordinate(ev, workspaceRef, song, gridTicks);
            const isInBounds = coord.tick >= 0 && coord.row >= 0 && coord.row < 12;

            if (isDragging) {
                if (isInBounds) {
                    onWorkspaceDrag(dragStart, coord);
                }
                onWorkspaceDragEnd();
                setIsDragging(false);
            }
            else if (isInBounds) {
                onWorkspaceClick(coord, ev.ctrlKey);
            }
        };
    }, [cursorLocation, dragStart, isDragging, onWorkspaceDrag, onWorkspaceDragEnd, onWorkspaceDragStart])

    const handleWorkspaceRef = (ref: SVGSVGElement) => {
        if (ref) workspaceRef = ref;
    }

    let gridHighlightStart: number;
    let gridHighlightEnd: number;

    let cursorPreviewLocation = (isDragging || eraserActive) ? undefined : cursorLocation;
    const eventAtCursor = cursorLocation && findNoteEventAtTick(song, selectedTrack, cursorLocation.tick);
    const dragEvent = dragStart && findNoteEventAtTick(song, selectedTrack, dragStart.tick)

    if (selection) {
        gridHighlightStart = selection.startTick + selection.deltaTick;
        gridHighlightEnd = selection.endTick + selection.deltaTick;
    }
    else if (!eraserActive && dragEvent && cursorLocation?.tick >= dragEvent.startTick) {
        gridHighlightStart = dragEvent.startTick;
        gridHighlightEnd = dragEvent.endTick;
    }
    else if (!eraserActive && isDragging && cursorLocation && dragStart) {
        gridHighlightStart = Math.min(cursorLocation.tick, dragStart.tick);
        gridHighlightEnd = Math.max(cursorLocation.tick, dragStart.tick);
    }
    else if (eventAtCursor) {
        gridHighlightStart = eventAtCursor.startTick;
        gridHighlightEnd = eventAtCursor.endTick;
    }
    else if (cursorLocation) {
        gridHighlightStart = cursorLocation.tick;
        gridHighlightEnd = cursorLocation.tick + gridTicks;
    }

    if (eventAtCursor && cursorPreviewLocation) {
        cursorPreviewLocation = {
            ...cursorPreviewLocation,
            tick: eventAtCursor.startTick
        }
    }

    const inactiveTracks = song.tracks.filter((t, i) => i !== selectedTrack);

    const height = showBassClef ? WORKSPACE_HEIGHT * 2 : WORKSPACE_HEIGHT;

    const songInfo = pxt.assets.music.getSongInfo(song);

    const svgWidth = workspaceWidth(song.measures, song.beatsPerMeasure) + 20;

    return <svg
        xmlns="http://www.w3.org/2000/svg"
        className={classList("music-workspace", eraserActive && "erasing")}
        viewBox={`0 0 ${svgWidth} ${height}`}
        aria-label={lf("Music Workspace")}
        tabIndex={0}
        onKeyDown={onKeydown}
        ref={handleWorkspaceRef}>
            <filter id="selection-outline">
                <feMorphology in="SourceAlpha" result="DILATED" operator="dilate" radius="4" />

                <feFlood floodColor="yellow" floodOpacity="1" result="FLOODED" />
                <feComposite in="FLOODED" in2="DILATED" operator="in" result="OUTLINE" />

                <feMerge>
                    <feMergeNode in="OUTLINE" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
            <filter id="cursor-outline">
                <feMorphology in="SourceAlpha" result="DILATED" operator="dilate" radius="4" />

                <feFlood floodColor="purple" floodOpacity="1" result="FLOODED" />
                <feComposite in="FLOODED" in2="DILATED" operator="in" result="OUTLINE" />

                <feMerge>
                    <feMergeNode in="OUTLINE" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        <rect
            x="0"
            y="0"
            width={svgWidth}
            height={height}
            fill="#FFFFFF"
            opacity={0}
        />
        <Staff
            {...songInfo}
            top={0}
            gridTicks={gridTicks} />
        {showBassClef &&
            <Staff
                {...songInfo}
                top={BASS_STAFF_TOP}
                isBassClef={true}
                gridTicks={gridTicks} />
        }
        <GridHighlight
            {...songInfo}
            start={gridHighlightStart}
            end={gridHighlightEnd} />

        {selection &&
            <WorkspaceSelection
                {...songInfo}
                range={selection} />
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
            cursorLocation={cursorPreviewLocation}
            keyboardCursor={cursor} />
    </svg>
}

function coordinateToWorkspaceCoordinate(ev: MouseEvent | PointerEvent | TouchEvent, el: SVGSVGElement, song: pxt.assets.music.Song, gridTicks?: number): WorkspaceClickCoordinate {
    const coord = screenToSVGCoord(el, clientCoord(ev));
    const isBassClef = coord.y > BASS_STAFF_TOP;

    // We add 1 tick to make it easier to click on the exact tick where a grid line begins
    const tick = closestTick(song.ticksPerBeat, coord.x + (BEAT_WIDTH / song.ticksPerBeat), gridTicks);
    const note = closestRow(coord.y);

    return {
        isBassClef,
        row: note,
        tick,
        exactTick: closestTick(song.ticksPerBeat, coord.x, 1)
    }
}