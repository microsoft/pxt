import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { Input } from "../../../../react-common/components/controls/Input";
import { classList } from "../../../../react-common/components/util";
import { addPlaybackStateListener, isLooping, isPlaying, removePlaybackStateListener, setLooping, startPlaybackAsync, stopPlayback } from "./playback";

export interface PlaybackControlsProps {
    song: pxt.assets.music.Song;
    onTempoChange: (newTempo: number) => void;
    onMeasuresChanged: (newMeasures: number) => void;

    hasUndo: boolean;
    hasRedo: boolean;
    onUndoClick: () => void;
    onRedoClick: () => void;
}

type PlaybackState = "stop" | "play" | "loop"

export const PlaybackControls = (props: PlaybackControlsProps) => {
    const {
        song,
        onTempoChange,
        onMeasuresChanged,
        onUndoClick,
        onRedoClick,
        hasUndo,
        hasRedo,
    } = props;

    const [state, setState] = React.useState<PlaybackState>("stop");


    React.useEffect(() => {
        const onStateChange = (state: PlaybackState) => {
            setState(state);
        };

        addPlaybackStateListener(onStateChange);

        return () => removePlaybackStateListener(onStateChange)
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

    const handleTempoChange = (newValue: string) => {
        let value = parseFloat(newValue);

        if (Number.isNaN(value)) return;

        value = Math.min(500, Math.max(20, Math.floor(value)));
        onTempoChange(value);
    }

    const handleMeasureMinusClick = () => {
        if (song.measures > 1) {
            onMeasuresChanged(song.measures - 1);
        }
    }

    const handleMeasurePlusClick = () => {
        if (song.measures < 50) {
            onMeasuresChanged(song.measures + 1);
        }
    }

    const handleMeasureChange = (newValue: string) => {
        let value = parseInt(newValue);

        if (isNaN(value) || value < 1 || value > 50) return;

        onMeasuresChanged(value);
    }

    return <div className="music-playback-controls">
        <div className="music-playback-buttons">
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
        <Input
            id="music-playback-tempo-input music-editor-label"
            label={lf("Tempo:")}
            initialValue={song.beatsPerMinute.toString()}
            onBlur={handleTempoChange}
            onEnterKey={handleTempoChange}
            />
        <div className="music-undo-redo common-button-group">
            <Button
                className="square-button purple"
                title={lf("Undo")}
                leftIcon="xicon undo"
                disabled={!hasUndo}
                onClick={onUndoClick} />
            <Button
                className="square-button purple"
                title={lf("Redo")}
                leftIcon="xicon redo"
                disabled={!hasRedo}
                onClick={onRedoClick} />
        </div>
        <div className="music-playback-measures">
            <div className="music-editor-label">
                {lf("Measures:")}
            </div>
            <Button
                className="menu-button"
                title={lf("Remove measure")}
                leftIcon="fas fa-minus-circle"
                onClick={handleMeasureMinusClick} />
            <Input
                id="music-playback-measures-input"
                initialValue={song.measures.toString()}
                onBlur={handleMeasureChange}
                onEnterKey={handleMeasureChange}
            />
            <Button
                className="menu-button"
                title={lf("Add measure")}
                leftIcon="fas fa-plus-circle"
                onClick={handleMeasurePlusClick} />
        </div>
    </div>
}