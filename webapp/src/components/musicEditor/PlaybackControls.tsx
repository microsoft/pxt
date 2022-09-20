import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { isPlaying, startPlaybackAsync, stopPlayback } from "./playback";

export interface PlaybackControlsProps {
    song: pxt.assets.music.Song;
}

export const PlaybackControls = (props: PlaybackControlsProps) => {
    const { song } = props;

    const onPlayClick = () => {
        if (!isPlaying()) {
            startPlaybackAsync(song, false);
        }
    }

    const onLoopClick = () => {
        if (!isPlaying()) {
            startPlaybackAsync(song, true);
        }
    }

    return <div>
        <Button
            title={lf("Stop")}
            leftIcon="fas fa-stop"
            onClick={stopPlayback} />
        <Button
            title={lf("Play")}
            leftIcon="fas fa-play"
            onClick={onPlayClick} />
        <Button
            title={lf("Loop")}
            leftIcon="fas fa-retweet"
            onClick={onLoopClick} />
    </div>
}