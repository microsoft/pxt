import * as React from "react";
import { noteLeft, noteWidth, range, xToTick } from "./utils";
import { usePianoRollTheme } from "./context";
import { WorkspaceSelection } from "./types";

interface Props {
    selection?: WorkspaceSelection;
    onKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void;
    snapTicks: number;
    onSelectionChange: (selection: WorkspaceSelection) => void;
}

export const MeasureHeader = ({ selection, onSelectionChange, onKeyDown, snapTicks }: Props) => {
    const { measures, tickWidth, ticksPerBeat, beatsPerMeasure } = usePianoRollTheme();

    const ref = React.useRef<HTMLDivElement>(null);
    const theme = usePianoRollTheme();
    const [pendingSelection, setPendingSelection] = React.useState<WorkspaceSelection>(undefined);

    React.useEffect(() => {
        if (!ref.current) return undefined;

        const header = ref.current;

        let selectionStartTick: number = undefined;
        let selectionEndTick: number = undefined;
        let dragging = false;

        const clientToTick = (clientX: number) => {
            const bounds = header.getBoundingClientRect();
            return xToTick(theme, clientX - bounds.left + header.scrollLeft);
        }

        const onPointerMove = (e: PointerEvent) => {
            if (!dragging) return;

            const tick = clientToTick(e.clientX);
            selectionEndTick = tick;
            setPendingSelection({
                startTick: Math.min(selectionStartTick, selectionEndTick),
                endTick: Math.max(selectionStartTick, selectionEndTick)
            });
        };

        const onPointerUp = (e: PointerEvent) => {
            dragging = false;

            const startTick = Math.min(selectionStartTick, selectionEndTick);
            const endTick = Math.max(selectionStartTick, selectionEndTick);

            if (startTick === endTick || endTick === undefined) {
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
            setPendingSelection({
                startTick: selectionStartTick,
                endTick: selectionStartTick
            });
        };


        header.addEventListener("pointerdown", onPointerDown);

        return () => {
            header.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerup", onPointerUp);
        };
    }, [onSelectionChange, theme]);

    const displaySelection = pendingSelection || selection;

    return (
        <div className="measure-header" id="measure-header" ref={ref} tabIndex={0} onKeyDown={onKeyDown}>
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