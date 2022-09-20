import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { classList } from "../../../../react-common/components/util";

export interface TrackSelectorProps {
    song: pxt.assets.music.Song;
    selected: number;
    onTrackSelected: (index: number) => void;
}

export const TrackSelector = (props: TrackSelectorProps) => {
    const { song, selected, onTrackSelected } = props;

    const setSelectedTrack = (index: number) => {
        onTrackSelected(index)
    }

    return <div className="music-track-selector">
        {song.tracks.map((track, index) =>
            <Button
                key={track.name}
                title={track.name}
                className={classList("music-track-button", selected === index && "selected")}
                label={<img src={track.iconURI} alt={track.name} />}
                onClick={() => setSelectedTrack(index)}
                />
        )}
    </div>
}