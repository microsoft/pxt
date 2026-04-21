import { Dropdown, DropdownItem } from "../../../../react-common/components/controls/Dropdown";
import { Input } from "../../../../react-common/components/controls/Input";
import { Song, lf, isDrumInstrument } from "./types";

interface Props {
    song: Song;
    selectedTrack: number;

    onTrackSelected(trackId: number): void;
    onTrackCreated(): void;
    onTrackDeleted(trackId: number): void;
    onInstrumentSelected(trackId: number, instrumentId: number): void;
    onOctavesChanged(minOctave: number, maxOctave: number): void;
}

export const Header = (props: Props) => {
    const { song, selectedTrack, onTrackSelected, onInstrumentSelected, onTrackCreated, onTrackDeleted, onOctavesChanged } = props;

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

    const rangeOptions: DropdownItem[] = [
        {
            label: lf("Treble"),
            title: lf("Treble"),
            id: "treble"
        },
        {
            label: lf("Bass"),
            title: lf("Bass"),
            id: "bass"
        },
        {
            label: lf("Full"),
            title: lf("Full"),
            id: "full"
        }
    ]

    const handleRangeDropdownChange = (id: string) => {
        if (id === "treble") {
            onOctavesChanged(3, 5);
        } else if (id === "bass") {
            onOctavesChanged(0, 3);
        } else if (id === "full") {
            onOctavesChanged(0, 8);
        }
    };

    let selectedRangeId = "full";
    if (track) {
        const minOctave = track.minOctave ?? 0;
        const maxOctave = track.maxOctave ?? 8;

        if (minOctave === 3 && maxOctave === 5) {
            selectedRangeId = "treble";
        }
        else if (minOctave === 0 && maxOctave === 3) {
            selectedRangeId = "bass";
        }
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

