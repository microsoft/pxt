import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { classList } from "../../../../react-common/components/util";
import { addPlaybackStopListener, isLooping, isPlaying, removePlaybackStopListener, setLooping, startPlaybackAsync, stopPlayback } from "./playback";

export interface PlaybackControlsProps {
    song: pxt.assets.music.Song;
}

type PlaybackState = "stop" | "play" | "loop"

export const PlaybackControls = (props: PlaybackControlsProps) => {
    const { song } = props;
    const [state, setState] = React.useState<PlaybackState>("stop");


    React.useEffect(() => {
        const onStop = () => {
            setState("stop");
        };

        addPlaybackStopListener(onStop);

        return () => removePlaybackStopListener(onStop)
    }, [])

    const onStopClick = () => {
        stopPlayback();
        setState("stop")
    }

    const onPlayClick = () => {
        startPlaybackAsync(song, false);
        setState("play")
    }

    const onLoopClick = () => {
        if (isLooping()) return;
        else if (isPlaying()) setLooping(true);
        else startPlaybackAsync(song, true);
        setState("loop")
    }

    return <div>
        <Button
            className="square-button"
            title={lf("Stop")}
            leftIcon="fas fa-stop"
            onClick={onStopClick} />
        <Button
            className={classList("square-button", state === "play" && "green")}
            title={lf("Play")}
            leftIcon="fas fa-play"
            onClick={onPlayClick} />
        <Button
            className={classList("square-button", state === "loop" && "green")}
            title={lf("Loop")}
            leftIcon="fas fa-retweet"
            onClick={onLoopClick} />
    </div>
}