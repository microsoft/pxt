import { usePianoRollTheme } from "./context";
import { NoteEvent } from "./types";
import { noteLeft } from "./utils";

interface Props {
    notes: NoteEvent[];
    onNotesChange: (note: NoteEvent[]) => void;
}

interface NoteOffset {
    events: NoteEvent[];
    velocity: number;
    start: number;
}

export const VelocityEditor = (props: Props) => {
    const { notes, onNotesChange } = props;
    const theme = usePianoRollTheme();
    const { octaveWidth, measures } = theme;

    const width = octaveWidth * measures;

    const offsets: NoteOffset[] = [];

    for (const note of notes) {
        const offset = offsets.find(o => o.start === note.start);
        if (offset) {
            offset.events.push(note);
        }
        else {
            offsets.push({ start: note.start, events: [note], velocity: note.velocity ?? 128 });
        }
    }

    return (
        <div id="velocity-editor" className="velocity-editor">
            <div className="velocity-editor-sidebar" />
            <div className="velocity-sliders" style={{ width: `${width}px` }}>
                {offsets.map((note, i) => (
                    <VelocitySlider
                        key={note.start}
                        velocity={note.velocity}
                        tick={note.start}
                        onChange={(velocity) => {
                            onNotesChange(note.events.map(e => ({ ...e, velocity })));
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

interface VelocitySliderProps {
    velocity: number;
    tick: number;
    onChange: (velocity: number) => void;
}


const VelocitySlider = (props: VelocitySliderProps) => {
    const { velocity, onChange, tick } = props;

    const theme = usePianoRollTheme();

    const description = lf("Change velocity for notes at tick {0}", tick);
    const fill = (velocity / 128) * 100 + "%";

    return (
        <div className="velocity-slider" style={{ left: noteLeft(theme, tick) }}>
            <div className="velocity-slider-inner">
                <div
                    className="velocity-slider-view"
                    style={{ height: fill }}
                />
                <input
                    type="range"
                    aria-orientation="vertical"
                    aria-label={description}
                    min={0}
                    step={8}
                    max={128}
                    value={velocity}
                    onChange={(e) => onChange(parseInt(e.target.value))}
                />
            </div>
        </div>
    );
}