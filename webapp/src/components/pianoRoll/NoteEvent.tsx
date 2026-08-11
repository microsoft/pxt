import { classList } from "../../../../react-common/components/util";
import { usePianoRollTheme } from "./context";
import { NoteEvent } from "./types";
import { getNoteName, noteLeft, noteTop, noteWidth } from "./utils";

interface Props {
    event: NoteEvent;
    isDrumTrack?: boolean;
    type?: "floating" | "selected"
}

export const NoteEventView = (props: Props) => {
    const { event, isDrumTrack, type } = props;
    const { duration, note, start, id } = event;

    const theme = usePianoRollTheme();

    return (
        <div
            id={`note-${id}`}
            className={classList("note-event", type)}
            style={{
                width: `${noteWidth(theme, duration)}px`,
                left: `${noteLeft(theme, start)}px`,
                top: `${noteTop(theme, note)}px`
            }}
            data-tick={start}
            data-note={note}
        >
            {isDrumTrack ? undefined : getNoteName(note)}
        </div>
    );
}