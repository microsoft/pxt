import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { Checkbox } from "../../../../react-common/components/controls/Checkbox";
import { Dropdown, DropdownItem } from "../../../../react-common/components/controls/Dropdown";
import { FocusList } from "../../../../react-common/components/controls/FocusList";
import { classList } from "../../../../react-common/components/util";

export interface TrackSelectorProps {
    song: pxt.assets.music.Song;
    selected: number;
    onTrackSelected: (index: number) => void;
    eraserActive: boolean;
    hideTracksActive: boolean;
    onHideTracksClick: () => void;
    onEraserClick: () => void;
    onResolutionSelected: (resolution: GridResolution) => void;
    selectedResolution: GridResolution;
}

export type GridResolution = "1/4" | "1/8" | "1/16" | "1/32";

const idToRes: pxt.Map<GridResolution> = {
    "four": "1/4",
    "eight": "1/8",
    "sixteen": "1/16",
    "thirtytwo": "1/32"
}

export const TrackSelector = (props: TrackSelectorProps) => {
    const { song, selected, onTrackSelected, selectedResolution, onResolutionSelected, eraserActive, onEraserClick, hideTracksActive, onHideTracksClick } = props;

    const setSelectedTrack = (index: number) => {
        onTrackSelected(index)
    }

    const gridChoices: DropdownItem[] = [
        {
            title: lf("1/4 Note"),
            label: lf("1/4"),
            id: "four"
        },
        {
            title: lf("1/8 Note"),
            label: lf("1/8"),
            id: "eight"
        },
        {
            title: lf("1/16 Note"),
            label: lf("1/16"),
            id: "sixteen"
        },
        {
            title: lf("1/32 Note"),
            label: lf("1/32"),
            id: "thirtytwo"
        }
    ];

    const handleDropdownSelection = (id: string) => {
        onResolutionSelected(idToRes[id]);
    }

    return <div className="music-track-selector">
        <FocusList role="radiogroup" ariaLabel={lf("Track selection")}>
            {song.tracks.map((track, index) =>
                <Button
                    role="radio"
                    ariaSelected={selected === index && !eraserActive}
                    ariaPosInSet={index + 1}
                    ariaSetSize={song.tracks.length + 1}
                    key={track.name}
                    title={track.name}
                    className={classList("music-track-button square-button pixellated", selected === index &&  !eraserActive && "selected")}
                    label={<img src={track.iconURI} alt={track.name} />}
                    onClick={() => setSelectedTrack(index)}
                    />
            )}
            <Button
                className={classList("music-track-button square-button", eraserActive && "selected")}
                title={eraserActive ? lf("Turn off eraser tool") : lf("Turn on eraser tool")}
                leftIcon="fas fa-eraser"
                ariaSelected={eraserActive}
                ariaPosInSet={song.tracks.length}
                ariaSetSize={song.tracks.length + 1}
                onClick={onEraserClick} />
        </FocusList>
        <Checkbox
            className="music-editor-label"
            id="hide-tracks"
            label={lf("Only show selected instrument")}
            isChecked={hideTracksActive}
            onChange={onHideTracksClick}
        />
        <div className="music-track-grid">
            <div className="music-editor-label">
                {lf("Grid:")}
            </div>
            <Dropdown
                id="grid-resolution"
                ariaLabel={lf("Staff grid resolution")}
                items={gridChoices}
                selectedId={Object.keys(idToRes).find(id => idToRes[id] === selectedResolution)}
                onItemSelected={handleDropdownSelection}
            />
        </div>
    </div>
}