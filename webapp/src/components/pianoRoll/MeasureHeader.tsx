import { range } from "./utils";
import { usePianoRollTheme } from "./context";

export const MeasureHeader = () => {
    const { measures, tickWidth, ticksPerBeat, beatsPerMeasure } = usePianoRollTheme();

    return (
        <div className="measure-header" id="measure-header">
            {range(0, measures).map(m =>
                <div key={m + 1} className="measure" style={{ width: tickWidth * ticksPerBeat * beatsPerMeasure }}>{m + 1}</div>
            )}
        </div>
    );
}