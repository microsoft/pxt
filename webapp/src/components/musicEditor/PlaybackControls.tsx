import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { Checkbox } from "../../../../react-common/components/controls/Checkbox";
import { Input } from "../../../../react-common/components/controls/Input";
import { classList } from "../../../../react-common/components/util";
import { addPlaybackStateListener, isLooping, isPlaying, removePlaybackStateListener, setLooping, startPlaybackAsync, stopPlayback } from "./playback";

export interface PlaybackControlsProps {
    measures: number;
    beatsPerMinute: number;
    onControlsClick(action: "play" | "stop" | "loop"): void;
    onTempoChange: (newTempo: number) => void;
    onMeasuresChanged: (newMeasures: number) => void;
    hideBassClefOption?: boolean;
    showBassClef?: boolean;
    onBassClefCheckboxClick?: (newValue: boolean) => void;

    singlePlayButton?: boolean;

    hasUndo: boolean;
    hasRedo: boolean;
    onUndoClick: () => void;
    onRedoClick: () => void
};

type PlaybackState = "stop" | "play" | "loop"

export const PlaybackControls = (props: PlaybackControlsProps) => {
    const {
        measures,
        beatsPerMinute,
        onControlsClick,
        onTempoChange,
        onMeasuresChanged,
        onUndoClick,
        onRedoClick,
        hasUndo,
        hasRedo,
        showBassClef,
        hideBassClefOption,
        onBassClefCheckboxClick,
        singlePlayButton
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
        onControlsClick("stop");
        setState("stop")
    }

    const onPlayClick = () => {
        onControlsClick("play");
        setState("play")
    }

    const onLoopClick = () => {
        if (isLooping()) return;
        else if (isPlaying()) setLooping(true);
        else onControlsClick("loop");
        setState("loop")
    }

    const handleTempoChange = (newValue: string) => {
        let value = parseFloat(newValue);

        if (Number.isNaN(value)) return;

        value = Math.min(500, Math.max(20, Math.floor(value)));
        onTempoChange(value);
    }

    const handleMeasureMinusClick = () => {
        if (measures > 1) {
            onMeasuresChanged(measures - 1);
        }
    }

    const handleMeasurePlusClick = () => {
        if (measures < 50) {
            onMeasuresChanged(measures + 1);
        }
    }

    const handleMeasureChange = (newValue: string) => {
        let value = parseInt(newValue);

        if (isNaN(value) || value < 1 || value > 50) return;

        onMeasuresChanged(value);
    }

    return <div className="music-playback-controls">
        <div className="music-playback-buttons">
            {!singlePlayButton &&
                <>
                    <Button
                        className="square-button"
                        title={lf("Stop")}
                        leftIcon="fas fa-stop"
                        onClick={onStopClick}
                    />
                    <Button
                        className={classList("square-button", state === "play" && "green")}
                        title={lf("Play")}
                        leftIcon="fas fa-play"
                        onClick={onPlayClick}
                    />
                    <Button
                        className={classList("square-button", state === "loop" && "green")}
                        title={lf("Loop")}
                        leftIcon="fas fa-retweet"
                        onClick={onLoopClick}
                    />
                </>
            }
            {singlePlayButton &&
                <Button
                    className={classList("square-button", state !== "stop" && "green")}
                    title={lf("Play")}
                    leftIcon={state === "stop" ? "fas fa-play" : "fas fa-stop"}
                    onClick={state === "stop" ? onLoopClick : onStopClick}
                />
            }
        </div>
        <Input
            id="music-playback-tempo-input music-editor-label"
            label={lf("Tempo:")}
            initialValue={beatsPerMinute.toString()}
            onBlur={handleTempoChange}
            onEnterKey={handleTempoChange} />
        <div className="spacer" />
        {!hideBassClefOption &&
            <Checkbox
                className="music-editor-label"
                id="show-bass-clef"
                label={lf("Show bass clef")}
                isChecked={showBassClef}
                onChange={onBassClefCheckboxClick} />
        }
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
                initialValue={measures.toString()}
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