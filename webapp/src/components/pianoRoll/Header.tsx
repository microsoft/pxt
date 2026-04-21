import { Button } from "../../../../react-common/components/controls/Button";
import { Dropdown, DropdownItem } from "../../../../react-common/components/controls/Dropdown";
import { Song, lf } from "./types";

interface Props {
    song: Song;
    selectedTrack: number;

    playing: boolean;

    onTrackSelected(trackId: number): void;
    onTrackCreated(): void;
    onTrackDeleted(trackId: number): void;
    onInstrumentSelected(trackId: number, instrumentId: number): void;
    togglePlaying(): void;
}

export const Header = (props: Props) => {
    const { song, selectedTrack, playing, onTrackSelected, onInstrumentSelected, onTrackCreated, onTrackDeleted, togglePlaying } = props;

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

    trackDropdownOptions.push({
        label: lf("Delete Track"),
        title: lf("Delete Track"),
        id: "delete-track",
        disabled: song.tracks.length === 1
    });

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

            <Button
                title={playing ? lf("Stop") : lf("Play")}
                leftIcon={playing ? "fas fa-stop" : "fas fa-play"}
                onClick={togglePlaying}
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

