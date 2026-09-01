import { useState } from "react";
import { Checkbox } from "../../../../react-common/components/controls/Checkbox";
import { Dropdown, DropdownItem } from "../../../../react-common/components/controls/Dropdown";
import { DropdownModal } from "../../../../react-common/components/controls/DropdownModal";
import { MenuDropdown, MenuItem } from "../../../../react-common/components/controls/MenuDropdown";
import { AssetNameModal } from "./AssetNameModal";
import { Song, lf, isDrumInstrument, NOTE_RANGES, SNAP_OPTIONS, TIME_SIGNATURES } from "./types";

interface Props {
    song: Song;
    selectedTrackId: number;
    velocityEditorVisible: boolean;
    snapTicks: number;
    showSnapControls: boolean;
    showTimeSignature: boolean;
    selectedTimeSignature: string;
    showAssetName: boolean;
    assetName?: string;

    onTrackSelected(trackId: number): void;
    onTrackCreated(): void;
    onTrackDeleted(trackId: number): void;
    onInstrumentSelected(trackId: number, instrumentId: number): void;
    onOctavesChanged(minOctave: number, maxOctave: number): void;
    onVelocityEditorToggle(): void;
    onSnapChanged(snapTicks: number): void;
    onTimeSignatureChanged: (newTimeSignature: string) => void;
    onAssetNameChanged: (newAssetName: string) => void;
}

export const Header = (props: Props) => {
    const {
        song,
        selectedTrackId: selectedTrack,
        velocityEditorVisible,
        snapTicks,
        showSnapControls,
        showTimeSignature,
        selectedTimeSignature,
        showAssetName,
        assetName,
        onAssetNameChanged,
        onVelocityEditorToggle,
        onTrackSelected,
        onInstrumentSelected,
        onTrackCreated,
        onTrackDeleted,
        onOctavesChanged,
        onSnapChanged,
        onTimeSignatureChanged
    } = props;

    const [modal, setModal] = useState<
        "change-octave-range" |
        "change-snap" |
        "change-time-signature" |
        "change-asset-name" |
        undefined
    >();

    const closeModal = () => {
        setModal(undefined);
    };

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

    const snapOptions: DropdownItem[] = SNAP_OPTIONS.map(option => ({
        label: option.name,
        title: option.name,
        id: option.id
    }));

    const overflowMenuItems: MenuItem[] = [];

    overflowMenuItems.push(
        {
            role: "menuitemcheckbox",
            label: lf("Velocity Editor"),
            isChecked: velocityEditorVisible,
            onChange: () => onVelocityEditorToggle(),
            id: "show-velocity-editor"
        }
    );

    if (!isDrum) {
        overflowMenuItems.push(
            {
                role: "menuitem",
                title: lf("Octave Range…"),
                label: lf("Octave Range…"),
                id: "change-octave-range",
                onClick: () => setModal("change-octave-range")
            }
        );
    }

    if (showSnapControls) {
        overflowMenuItems.push(
            {
                role: "menuitem",
                label: lf("Snap…"),
                title: lf("Snap…"),
                id: "change-snap",
                onClick: () => setModal("change-snap")
            }
        );
    }

    if (showTimeSignature) {
        overflowMenuItems.push(
            {
                role: "menuitem",
                label: lf("Time Signature…"),
                title: lf("Time Signature…"),
                id: "change-time-signature",
                onClick: () => setModal("change-time-signature")
            }
        );
    }

    if (showAssetName) {
        overflowMenuItems.push(
            {
                role: "menuitem",
                label: lf("Asset Name…"),
                title: lf("Asset Name…"),
                id: "change-asset-name",
                onClick: () => setModal("change-asset-name")
            }
        );
    }

    const timeSignatures: DropdownItem[] = TIME_SIGNATURES.map(ts => ({
        label: ts.name,
        title: ts.name,
        id: ts.id
    }));

    return (
        <div className="header">
            { modal === "change-octave-range" &&
                <DropdownModal
                    id="change-octave-range"
                    items={rangeOptions}
                    selectedId={selectedRangeId}
                    onItemSelected={handleRangeDropdownChange}
                    onClose={closeModal}
                />
            }
            { modal === "change-snap" &&
                <DropdownModal
                    id="change-snap"
                    items={snapOptions}
                    selectedId={snapTicksToId(snapTicks)}
                    onItemSelected={(id) => onSnapChanged(snapIdToTicks(id))}
                    onClose={closeModal}
                />
            }
            { modal === "change-time-signature" &&
                <DropdownModal
                    id="change-time-signature"
                    items={timeSignatures}
                    selectedId={selectedTimeSignature}
                    onItemSelected={onTimeSignatureChanged}
                    onClose={closeModal}
                />
            }
            { modal === "change-asset-name" &&
                <AssetNameModal
                    assetName={assetName}
                    onAssetNameChanged={onAssetNameChanged}
                    onClose={closeModal}
                />
            }
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
                <div className="octave-controls mobile-hidden">
                    <div className="music-editor-label tablet-hidden">
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
                className="mobile-hidden velocity-editor-toggle"
                id="velocity-editor-toggle"
                label={lf("Show Velocity Editor")}
                isChecked={velocityEditorVisible}
                onChange={onVelocityEditorToggle}
            />
            <div className="spacer" />
            {showSnapControls &&
                <>
                    <div className="music-editor-label mobile-hidden">
                        {lf("Snap:")}
                    </div>
                    <Dropdown
                        id="snap-select"
                        className="mobile-hidden"
                        items={snapOptions}
                        selectedId={snapTicksToId(snapTicks)}
                        onItemSelected={(id) => onSnapChanged(snapIdToTicks(id))}
                    />
                </>
            }

            <MenuDropdown
                className="mobile-only"
                id="overflow-menu"
                items={overflowMenuItems}
                icon="fas fa-ellipsis-v"
                title={lf("More Options")}
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

function snapIdToTicks(id: string) {
    const option = SNAP_OPTIONS.find(option => option.id === id);
    return option?.ticksPerSnap ?? 1;
}

function snapTicksToId(ticks: number) {
    const option = SNAP_OPTIONS.find(option => option.ticksPerSnap === ticks);
    return option?.id ?? "sixteenth";
}