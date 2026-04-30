import { useEffect, useRef, useState } from "react";
import { classList } from "../../../../react-common/components/util";
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

    const [highlightedTick, setHighlightedTick] = useState<Number>(undefined);

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

    const highlightTick = (tick: number) => {
        if (tick !== highlightedTick) {
            if (highlightedTick) {
                const previousEvents = offsets.find(n => n.start === highlightedTick);
                if (previousEvents) {
                    for (const note of previousEvents.events) {
                        const el = document.getElementById(`note-${note.id}`);
                        if (el) {
                            el.classList.remove("highlighted");
                        }
                    }
                }
            }
            setHighlightedTick(tick);
            const currentEvents = offsets.find(n => n.start === tick);
            if (currentEvents) {
                for (const note of currentEvents.events) {
                    const el = document.getElementById(`note-${note.id}`);
                    if (el) {
                        el.classList.add("highlighted");
                    }
                }
            }
        }
    }

    const onHighlightEnd = (tick: number) => {
        if (highlightedTick === tick) {
            const currentEvents = offsets.find(n => n.start === tick);
            if (currentEvents) {
                for (const note of currentEvents.events) {
                    const el = document.getElementById(`note-${note.id}`);
                    if (el) {
                        el.classList.remove("highlighted");
                    }
                }
            }
            setHighlightedTick(undefined);
        }
    }

    return (
        <div id="velocity-editor" className="velocity-editor">
            <div className="velocity-editor-sidebar" />
            <div className="velocity-sliders" style={{ width: `${width}px` }}>
                {offsets.map((notes, i) => (
                    <VelocitySlider
                        key={notes.start}
                        velocity={notes.velocity}
                        tick={notes.start}
                        highlighted={highlightedTick === notes.start}
                        onHighlight={highlightTick}
                        onHighlightEnd={onHighlightEnd}
                        onChange={(velocity) => {
                            onNotesChange(notes.events.map(e => ({ ...e, velocity })));
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
    highlighted: boolean;
    onChange: (velocity: number) => void;
    onHighlight: (tick: number) => void;
    onHighlightEnd: (tick: number) => void;
}


const VelocitySlider = (props: VelocitySliderProps) => {
    const { velocity, onChange, tick, onHighlight, onHighlightEnd, highlighted } = props;

    const theme = usePianoRollTheme();

    const description = lf("Change velocity for notes at tick {0}", tick);
    const fill = (velocity / 128) * 100 + "%";

    const sliderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onHover = (e: MouseEvent) => {
            onHighlight(tick);
        }

        const onHoverEnd = (e: MouseEvent) => {
            onHighlightEnd(tick);
        }
        sliderRef.current?.addEventListener("pointerenter", onHover);
        sliderRef.current?.addEventListener("pointerleave", onHoverEnd);

        return () => {
            sliderRef.current?.removeEventListener("pointerenter", onHover);
            sliderRef.current?.removeEventListener("pointerleave", onHoverEnd);
        }
    }, [onHighlight, onHighlightEnd, tick])

    return (
        <div
            id={`velocity-slider-${tick}`}
            className={classList("velocity-slider", highlighted && "highlighted")}
            style={{ left: noteLeft(theme, tick) }}
            ref={sliderRef}
        >
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