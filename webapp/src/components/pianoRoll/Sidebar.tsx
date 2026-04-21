import { usePianoRollTheme } from "./context";
import { PianoOctave } from "./PianoOctave";
import { Instrument } from "./types";
import { range } from "./utils";

interface Props {
    selectedTrack: number;
    instrument: Instrument;
}

export const Sidebar = (props: Props) => {
    const { selectedTrack, instrument } = props;
    const { minOctave, maxOctave } = instrument;

    const octaves = range(minOctave, maxOctave + 1);
    octaves.reverse();

    return (
        <div className="sidebar">
            {octaves.map(octave => <PianoOctave key={octave} octave={octave} selectedTrack={selectedTrack} instrument={instrument} />)}
        </div>
    );
}