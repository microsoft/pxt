import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { Input } from "../../../../react-common/components/controls/Input";
import { classList } from "../../../../react-common/components/util";
import { addPlaybackStopListener, isLooping, isPlaying, removePlaybackStopListener, setLooping, startPlaybackAsync, stopPlayback } from "./playback";

export interface PlaybackControlsProps {
    song: pxt.assets.music.Song;
    onTempoChange: (newTempo: number) => void;
    onMeasuresChanged: (newMeasures: number) => void;
    onUndoClick: () => void;
    onRedoClick: () => void;
    hasUndo: boolean;
    hasRedo: boolean;
    eraserActive: boolean;
    onEraserClick: () => void;
    hideTracksActive: boolean;
    onHideTracksClick: () => void;
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
        eraserActive,
        hideTracksActive,
        onEraserClick,
        onHideTracksClick
    } = props;

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
            id="music-playback-tempo-input"
            label={lf("Tempo:")}
            initialValue={song.beatsPerMinute.toString()}
            onBlur={handleTempoChange}
            onEnterKey={handleTempoChange}
            />
        <div className="music-playback-buttons">
            <Button
                className="square-button"
                title={lf("Undo")}
                leftIcon="xicon undo"
                disabled={!hasUndo}
                onClick={onUndoClick} />
            <Button
                className="square-button"
                title={lf("Redo")}
                leftIcon="xicon redo"
                disabled={!hasRedo}
                onClick={onRedoClick} />
        </div>
        <div className="music-playback-buttons">
            <Button
                className={classList("square-button", eraserActive && "green")}
                title={eraserActive ? lf("Turn off eraser tool") : lf("Turn on eraser tool")}
                leftIcon="fas fa-eraser"
                onClick={onEraserClick} />
            <Button
                className={classList("square-button", hideTracksActive && "green")}
                title={hideTracksActive ? lf("Show all tracks") : lf("Hide unselected tracks")}
                leftIcon={hideTracksActive ? "fas fa-eye-slash" : "fas fa-eye"}
                onClick={onHideTracksClick} />
        </div>
        <div className="music-playback-measures">
            <div className="music-playback-label">
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