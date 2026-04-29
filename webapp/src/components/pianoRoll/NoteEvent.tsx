import { usePianoRollTheme } from "./context";
import { NoteEvent } from "./types";
import { getNoteName, noteLeft, noteTop, noteWidth } from "./utils";

interface Props {
    event: NoteEvent;
    isDrumTrack?: boolean;
}

export const NoteEventView = (props: Props) => {
    const { event, isDrumTrack } = props;
    const { duration, note, start, id } = event;

    const theme = usePianoRollTheme();

    return (
        <div
            id={`note-${id}`}
            className="note-event"
            style={{
                width: `${noteWidth(theme, duration)}px`,
                left: `${noteLeft(theme, start)}px`,
                top: `${noteTop(theme, note)}px`
            }}
        >
            {isDrumTrack ? undefined : getNoteName(note)}
        </div>
    );
}