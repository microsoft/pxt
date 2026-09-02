import { noteLeft, noteWidth, range, xToTick } from "./utils";
import { usePianoRollTheme } from "./context";
import { WorkspaceSelection } from "./types";
import { useEffect, useRef, useState } from "react";

interface Props {
    selection?: WorkspaceSelection;
    snapTicks: number;
    onSelectionChange: (selection: WorkspaceSelection) => void;
    addEventListeners: (el: HTMLElement) => void;
}

export const MeasureHeader = ({ selection, onSelectionChange, addEventListeners, snapTicks }: Props) => {
    const { measures, tickWidth, ticksPerBeat, beatsPerMeasure } = usePianoRollTheme();

    const ref = useRef<HTMLDivElement>(null);
    const theme = usePianoRollTheme();
    const [pendingSelection, setPendingSelection] = useState<WorkspaceSelection>(undefined);

    useEffect(() => {
        if (!ref.current) return undefined;

        const header = ref.current;

        let selectionStartTick: number = undefined;
        let selectionEndTick: number = undefined;
        let dragging = false;

        const updateSelection = (startTick: number, endTick: number) => {
            setPendingSelection({
                startTick: Math.floor(Math.min(startTick, endTick) / snapTicks) * snapTicks,
                endTick: Math.ceil(Math.max(startTick, endTick) / snapTicks) * snapTicks
            });
        };

        const clientToTick = (clientX: number) => {
            const bounds = header.getBoundingClientRect();
            return xToTick(theme, clientX - bounds.left + header.scrollLeft);
        }

        const onPointerMove = (e: PointerEvent) => {
            if (!dragging) return;

            const tick = clientToTick(e.clientX);
            selectionEndTick = tick;
            updateSelection(selectionStartTick, selectionEndTick);
        };

        const onPointerUp = (e: PointerEvent) => {
            dragging = false;

            const startTick = Math.min(selectionStartTick, selectionEndTick);
            const endTick = Math.max(selectionStartTick, selectionEndTick);

            if (startTick === endTick || endTick === undefined || Number.isNaN(startTick) || Number.isNaN(endTick)) {
                onSelectionChange(undefined);
            }
            else {
                onSelectionChange({ startTick, endTick });
            }

            setPendingSelection(undefined);

            selectionStartTick = undefined;
            selectionEndTick = undefined;
            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerup", onPointerUp);
        };

        const onPointerDown = (e: PointerEvent) => {
            e.preventDefault();
            selectionStartTick = clientToTick(e.clientX);
            dragging = true;
            document.addEventListener("pointermove", onPointerMove);
            document.addEventListener("pointerup", onPointerUp);
            updateSelection(selectionStartTick, selectionStartTick);

            document.getElementById("piano-roll-workspace")?.focus();
        };


        header.addEventListener("pointerdown", onPointerDown);

        return () => {
            header.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerup", onPointerUp);
        };
    }, [onSelectionChange, theme]);


    useEffect(() => {
        if (!ref.current) return undefined;

        return addEventListeners(ref.current);
    }, [addEventListeners]);
    const displaySelection = pendingSelection || selection;

    return (
        <div className="measure-header" id="measure-header" ref={ref}>
            {range(0, measures).map(m =>
                <div key={m + 1} className="measure" style={{ width: tickWidth * ticksPerBeat * beatsPerMeasure }}>{m + 1}</div>
            )}
            {displaySelection &&
                <div
                    id="measure-header-selection"
                    className="selection"
                    style={{
                        left: noteLeft(theme, displaySelection.startTick),
                        width: noteWidth(theme, displaySelection.endTick - displaySelection.startTick)
                    }}
                ></div>
            }
        </div>
    );
}