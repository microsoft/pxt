import { useCallback, useEffect, useRef } from "react";
import { classList } from "../../../../react-common/components/util";
import { addNoteChangeListener, removeNoteChangeListener } from "../musicEditor/playback";
import { Instrument, isDrumInstrument } from "./types";
import { getNoteName, isBlackKey, range} from "./utils";

interface Props {
    octave: number;
    selectedTrack: number;
    instrument: Instrument;
}

export const PianoOctave = (props: Props) => {
    const { octave, selectedTrack, instrument } = props;

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;

        const handleNoteChange = (track: number, note: number, on: boolean) => {
            if (track !== selectedTrack) return;
            if (note < octave * 12 || note >= (octave + 1) * 12) return;

            const key = container.querySelector(`#key-${note}`) as HTMLDivElement | null;
            if (key) {
                key.classList.toggle("active", on);
            }
        }

        for (let i = 0; i < 12; i++) {
            const note = (11 - i) + octave * 12;
            const key = container.querySelector(`#key-${note}`) as HTMLDivElement | null;
            if (key) {
                key.classList.toggle("active", false);
            }
        }

        addNoteChangeListener(handleNoteChange);

        return () => {
            removeNoteChangeListener(handleNoteChange);
        };
    }, [octave, selectedTrack]);

    const playNote = useCallback(async (note: number) => {
        const ref = containerRef.current?.querySelector(`#key-${note}`) as HTMLDivElement | null;
        if (ref) {
            ref.classList.add("playing");
        }

        if (isDrumInstrument(instrument)) {
            const drum = instrument.drums[note];
            if (drum) {
                await pxsim.music.playDrumAsync(drum);
            }
        }
        else {
            await pxsim.music.playNoteAsync(note, instrument.instrument, 300)
        }

        if (ref) {
            ref.classList.remove("playing");
        }
    }, [instrument]);

    const isDrum = isDrumInstrument(instrument);

    return (
        <div className="octave-sidebar" ref={containerRef}>
            {
                range(0, 12).map(index => {
                    const note = (11 - index) + octave * 12;
                    const isBlack = isBlackKey(note);
                    const noteName = isDrum ? instrument.drums[note].name! : getNoteName(note);

                    const classes = classList(
                        isDrum ? "drum" : "key",
                        isBlack ? "black" : "white",
                        getNoteName(note, false).replace("#", "sharp")
                    );

                    const text = ((note % 12) && !isDrum) ? undefined : noteName; // Only show note name for C notes

                    const onClick = () => {
                        playNote(note);
                    }

                    return (
                        <div key={note} id={`key-${note}`} className={classes} title={noteName} onClick={onClick}>
                            {text}
                        </div>
                    );
                })
            }
        </div>
    );
}