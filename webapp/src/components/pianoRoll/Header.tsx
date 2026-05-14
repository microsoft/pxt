import { Checkbox } from "../../../../react-common/components/controls/Checkbox";
import { Dropdown, DropdownItem } from "../../../../react-common/components/controls/Dropdown";
import { Song, lf, isDrumInstrument, NOTE_RANGES } from "./types";

interface Props {
    song: Song;
    selectedTrack: number;
    velocityEditorVisible: boolean;

    onTrackSelected(trackId: number): void;
    onTrackCreated(): void;
    onTrackDeleted(trackId: number): void;
    onInstrumentSelected(trackId: number, instrumentId: number): void;
    onOctavesChanged(minOctave: number, maxOctave: number): void;
    onVelocityEditorToggle(): void;
}

export const Header = (props: Props) => {
    const { song, selectedTrack, velocityEditorVisible, onVelocityEditorToggle, onTrackSelected, onInstrumentSelected, onTrackCreated, onTrackDeleted, onOctavesChanged } = props;

    const onTrackDropdownChange = (id: string) => {
        if (id === "new-track") {
            onTrackCreated();
        }
        else if (id === "delete-track") {
            onTrackDeleted(selectedTrack);
        }
        else {
            const trackId = parseTrackId(id);
            onTrackSelected(trackId);
        }
    };

    const onInstrumentDropdownChange = (id: string) => {
        const instrumentId = parseInstrumentId(id);
        onInstrumentSelected(selectedTrack, instrumentId);
    };

    const track = song.tracks.find(t => t.id === selectedTrack);
    const instrument = song.instruments.find(i => i.id === track?.instrumentId);

    const isDrum = isDrumInstrument(instrument!);

    const trackDropdownOptions: DropdownItem[] = song.tracks.map(
        track => {
            const label = lf("Track {0}", track.id);

            return {
                label,
                title: label,
                id: trackId(track.id)
            }
        }
    );

    trackDropdownOptions.push({
        label: lf("New Track..."),
        title: lf("New Track..."),
        id: "new-track"
    });

    if (song.tracks.length > 1) {
        trackDropdownOptions.push({
            label: lf("Delete Track"),
            title: lf("Delete Track"),
            id: "delete-track",
        });
    }

    const rangeOptions: DropdownItem[] = NOTE_RANGES.map(range => ({
        label: range.name,
        title: range.name,
        id: range.id
    }));

    const handleRangeDropdownChange = (id: string) => {
        const range = NOTE_RANGES.find(r => r.id === id);

        if (!range) return;
        onOctavesChanged(range.minOctave, range.maxOctave);
    };

    let selectedRangeId = "full";
    const range = NOTE_RANGES.find(r => r.minOctave === track?.minOctave && r.maxOctave === track?.maxOctave);

    if (range) {
        selectedRangeId = range.id;
    }


    return (
        <div className="header">
            <Dropdown
                id="track-select"
                items={trackDropdownOptions}
                selectedId={trackId(selectedTrack)}
                onItemSelected={onTrackDropdownChange}
            />
            <Dropdown
                id="instrument-select"
                items={song.instruments.map(
                    instrument => ({
                        label: instrument.name,
                        title: instrument.name,
                        id: instrumentId(instrument.id)
                    })
                )}
                selectedId={instrumentId(track?.instrumentId ?? 0)}
                onItemSelected={onInstrumentDropdownChange}
            />
            {!isDrum &&
                <div className="octave-controls">
                    <div className="music-editor-label">
                        {lf("Range:")}
                    </div>
                    <Dropdown
                        id="range-select"
                        items={rangeOptions}
                        selectedId={selectedRangeId}
                        onItemSelected={handleRangeDropdownChange}
                    />
                </div>
            }
            <Checkbox
                id="velocity-editor-toggle"
                label={lf("Show Velocity Editor")}
                isChecked={velocityEditorVisible}
                onChange={onVelocityEditorToggle}
            />
        </div>
    );
}

function trackId(trackId: number) {
    return `track-${trackId}`;
}

function parseTrackId(id: string) {
    return parseInt(id.replace("track-", ""));
}

function instrumentId(instrumentId: number) {
    return `instrument-${instrumentId}`;
}

function parseInstrumentId(id: string) {
    return parseInt(id.replace("instrument-", ""));
}

