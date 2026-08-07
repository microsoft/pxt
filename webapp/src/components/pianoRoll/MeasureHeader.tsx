import * as React from "react";
import { noteLeft, noteWidth, range, xToTick } from "./utils";
import { usePianoRollTheme } from "./context";
import { WorkspaceSelection } from "./types";

interface Props {
    selection?: WorkspaceSelection;
    onSelectionChange: (selection: WorkspaceSelection) => void;
}

export const MeasureHeader = ({ selection, onSelectionChange }: Props) => {
    const { measures, tickWidth, ticksPerBeat, beatsPerMeasure } = usePianoRollTheme();

    const ref = React.useRef<HTMLDivElement>(null);
    const theme = usePianoRollTheme();

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
        };


        header.addEventListener("pointerdown", onPointerDown);

        return () => {
            header.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerup", onPointerUp);
        };
    }, [onSelectionChange, theme]);

    return (
        <div className="measure-header" id="measure-header" ref={ref}>
            {range(0, measures).map(m =>
                <div key={m + 1} className="measure" style={{ width: tickWidth * ticksPerBeat * beatsPerMeasure }}>{m + 1}</div>
            )}
            {selection &&
                <div
                    id="measure-header-selection"
                    className="selection"
                    style={{
                        left: noteLeft(theme, selection.startTick),
                        width: noteWidth(theme, selection.endTick - selection.startTick)
                    }}
                ></div>
            }
        </div>
    );
}