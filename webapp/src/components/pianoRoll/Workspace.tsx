import { useEffect, useRef } from "react";
import { addPlaybackStateListener, addTickListener, removePlaybackStateListener, removeTickListener } from "../musicEditor/playback";
import { usePianoRollTheme } from "./context";
import { NoteEventView } from "./NoteEvent"
import { changeNoteEventDuration, getMaxDuration, newNoteEvent, NoteEvent, Track } from "./types";
import { noteWidth, range, workspaceHeight, workspaceWidth, xToTick, yToNote } from "./utils";
import { useWorkspaceBackground } from "./workspaceBackground";

interface Props {
    track: Track;
    isDrumTrack: boolean;
    playNote: (note: number) => void;
    onEdit: (track: Track) => void;
    measures: number;
}

interface GestureState {
    startX: number;
    startY: number;
    startScrollX: number;
    startScrollY: number;
    noteEvent?: NoteEvent;
    isScrolling?: boolean
    noteElement?: HTMLDivElement;
}

export const Workspace = (props: Props) => {
    const { track, onEdit, isDrumTrack, playNote, measures } = props;

    const bg = useWorkspaceBackground();
    const theme = usePianoRollTheme();

    const workspaceRef = useRef<HTMLDivElement>(null);
    const playheadRef = useRef<HTMLDivElement>(null);
    const gestureState = useRef<GestureState | null>(null);

    useEffect(() => {
        const horizontalScroller = workspaceRef.current?.parentElement;
        const verticalScroller = horizontalScroller?.parentElement?.parentElement;
        const measureScroller = document.getElementById("measure-header");

        const clientToNoteCoordinates = (clientX: number, clientY: number) => {
            const bounds = workspaceRef.current?.getBoundingClientRect();
            if (!bounds) return null;

            const x = clientX - bounds.left;
            const y = clientY - bounds.top;

            const note = yToNote(theme, y);
            const time = xToTick(theme, x);

            return { note, time };
        }

        const getNewNoteDuration = (clientX: number, clientY: number) => {
            const editing = gestureState.current!.noteEvent!;
            const coords = clientToNoteCoordinates(clientX, clientY);
            if (!coords) return 1;

            const max = getMaxDuration(editing.note, editing.start + 1, track, measures);

            return Math.max(1, Math.min(max, coords.time - editing.start + 1));
        }

        const getNoteEventAtPosition = (x: number, y: number): NoteEvent | undefined => {
            const { note, time } = clientToNoteCoordinates(x, y) || {};
            if (note === undefined || time === undefined) return undefined;

            return track.events.find(e => e.note === note && e.start <= time && time < e.start + e.duration);
        }

        const updateGesture = (e: PointerEvent) => {
            if (!gestureState.current) return;

            const deltaX = e.clientX - gestureState.current.startX;
            const deltaY = e.clientY - gestureState.current.startY;
            if (!gestureState.current.isScrolling) {
                if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                    gestureState.current.isScrolling = true;
                }
            }

            if (gestureState.current.isScrolling) {
                if (!gestureState.current.noteEvent || isDrumTrack) {
                    if (horizontalScroller) {
                        horizontalScroller.scrollLeft = gestureState.current.startScrollX - deltaX;
                    }
                    if (measureScroller) {
                        measureScroller.scrollLeft = gestureState.current.startScrollX - deltaX;
                    }
                    if (verticalScroller) {
                        verticalScroller.scrollTop = gestureState.current.startScrollY - deltaY;
                    }
                }
                else {
                    const editing = gestureState.current.noteEvent;

                    if (!gestureState.current.noteElement) {
                        gestureState.current.noteElement = document.getElementById(`note-${editing.id}`) as HTMLDivElement;
                    }

                    if (gestureState.current.noteElement) {
                        gestureState.current.noteElement.style.width = `${noteWidth(theme, getNewNoteDuration(e.clientX, e.clientY))}px`;
                    }
                }
            }
        }

        const onPointerDown = (e: PointerEvent) => {
            gestureState.current = {
                startX: e.clientX,
                startY: e.clientY,
                startScrollX: horizontalScroller?.scrollLeft || 0,
                startScrollY: verticalScroller?.scrollTop || 0,
                noteEvent: getNoteEventAtPosition(e.clientX, e.clientY)
            };

            updateGesture(e);
        }

        const onPointerMove = (e: PointerEvent) => {
            updateGesture(e);
        }

        const onPointerUp = (e: PointerEvent) => {
            if (!gestureState.current) return;
            updateGesture(e);

            if (!gestureState.current.isScrolling) {
                if (gestureState.current.noteEvent) {
                    onEdit({
                        ...track,
                        events: track.events.filter(e => e !== gestureState.current?.noteEvent)
                    });
                }
                else {
                    const coords = clientToNoteCoordinates(gestureState.current.startX, gestureState.current.startY);

                    if (coords) {
                        onEdit(newNoteEvent(coords.note, coords.time, track, isDrumTrack, measures));
                        playNote(coords.note);
                    }
                }
            }
            else if (gestureState.current.noteEvent && !isDrumTrack) {
                onEdit(changeNoteEventDuration(gestureState.current.noteEvent.id, getNewNoteDuration(e.clientX, e.clientY), track, measures));
            }

            gestureState.current = null;
        }

        workspaceRef.current?.addEventListener("pointerdown", onPointerDown);
        workspaceRef.current?.addEventListener("pointermove", onPointerMove);
        workspaceRef.current?.addEventListener("pointerup", onPointerUp);
        workspaceRef.current?.addEventListener("pointercancel", onPointerUp);
        workspaceRef.current?.addEventListener("pointerleave", onPointerUp);

        return () => {
            workspaceRef.current?.removeEventListener("pointerdown", onPointerDown);
            workspaceRef.current?.removeEventListener("pointermove", onPointerMove);
            workspaceRef.current?.removeEventListener("pointerup", onPointerUp);
            workspaceRef.current?.removeEventListener("pointercancel", onPointerUp);
            workspaceRef.current?.removeEventListener("pointerleave", onPointerUp);
        }
    }, [track, onEdit, theme.minOctave, theme.maxOctave, isDrumTrack])


    useEffect(() => {
        const tickTime = pxsim.music.tickToMs(120, 4, 1);
        const tickDistance = noteWidth(theme, 1);
        let playbackHeadPosition = 0;
        let isPlaying = false;
        let animationFrameRef: number;
        let lastTime: number;

        const onTick = (tick: number) => {
            playbackHeadPosition = noteWidth(theme, tick);
            lastTime = Date.now();
            if (!isPlaying) {
                isPlaying = true;
                playheadRef.current.style.left = `${playbackHeadPosition}px`;
                playheadRef.current.style.display = "unset";
                animationFrameRef = requestAnimationFrame(onAnimationFrame);
            }
        }

        const onStop = () => {
            isPlaying = false;
            playheadRef.current.style.display = "none";
            if (animationFrameRef) cancelAnimationFrame(animationFrameRef);
        }

        const onAnimationFrame = () => {
            const position = playbackHeadPosition + tickDistance * (Date.now() - lastTime) / tickTime;
            playheadRef.current.style.left = `${position}px`;
            if (isPlaying) animationFrameRef = requestAnimationFrame(onAnimationFrame);
        }

        addTickListener(onTick);
        addPlaybackStateListener(onStop);

        return () => {
            removeTickListener(onTick);
            removePlaybackStateListener(onStop);
            if (animationFrameRef) cancelAnimationFrame(animationFrameRef);
        }
    }, [theme])

    return (
        <div className="workspace" style={{
            backgroundImage: bg,
            width: workspaceWidth(theme),
            height: workspaceHeight(theme)
        }} ref={workspaceRef}>
            <div className="playhead" ref={playheadRef}></div>
            {track.events.map((e, i) => <NoteEventView key={i} event={e} isDrumTrack={isDrumTrack} />)}
        </div>
    );
}