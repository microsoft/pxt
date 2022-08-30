import * as React from "react";
import { Button } from "../controls/Button";

type RecorderState = "default" | "recording" | "rendering";

export interface GifRecorderProps {
    onScreenshot?: () => void;
    onRecordStart?: () => void;
    onRecordStop?: () => Promise<void>;
    onGifFrame?: (dataUri: ImageData, delay?: number) => boolean;
    registerSimulatorMsgHandler?: (handler: (msg: any) => void) => void;
    unregisterSimulatorMsgHandler?: () => void;
}

export interface SimRecorderProps {
    onSimRecorderInit: (ref: SimRecorderRef) => void;
}
export type SimRecorder = (props: SimRecorderProps) => JSX.Element
export type SimRecorderState = "default" | "recording" | "rendering"
export interface SimRecorderRef {
    state: SimRecorderState;
    startRecordingAsync: () => Promise<void>;
    stopRecordingAsync: () => Promise<string>;
    screenshotAsync: () => Promise<string>;
    onStateChange: (handler: (newState: SimRecorderState) => void) => void;
    onThumbnail: (handler: (uri: string, type: "gif" | "png") => void) => void;
}

export const GifRecorder = (props: GifRecorderProps) => {
    const { onScreenshot, onRecordStart, onRecordStop, onGifFrame,
        registerSimulatorMsgHandler, unregisterSimulatorMsgHandler } = props;
    const [ recorderState, _setRecorderState ] = React.useState<RecorderState>("default");
    const recorderStateRef = React.useRef(recorderState);
    const targetTheme = pxt.appTarget.appTheme;

    const setRecorderState = (state: RecorderState) => {
        _setRecorderState(state);
        recorderStateRef.current = state;
    }

    const onGifRecordStop = async () => {
        setRecorderState("rendering");
        await onRecordStop();
        setRecorderState("default");
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        const pressed = e.key.toLocaleLowerCase();
        if (targetTheme.simScreenshotKey && pressed === targetTheme.simScreenshotKey.toLocaleLowerCase()) {
            onScreenshot();
        } else if (targetTheme.simGifKey && pressed === targetTheme.simGifKey.toLocaleLowerCase()) {
            if (recorderStateRef.current === "recording") {
                onGifRecordStop();
            } else {
                onGifRecordStart();
            }
        }
    }

    const handleSimulatorMsg = (e: any) => {
        if (e.type === "screenshot") {
            if (recorderStateRef.current === "recording") {
                // Adds frame, returns true if we've exceeded the max frame count
                if (onGifFrame(e.data, e.delay)) {
                    onGifRecordStop();
                }
            } else {
                onScreenshot();
            }
        } else if (e.event === "start") {
            onGifRecordStart();
        } else if (e.event === "stop") {
            onGifRecordStop();
        }
    }

    React.useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        if (registerSimulatorMsgHandler) registerSimulatorMsgHandler(handleSimulatorMsg);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            if (unregisterSimulatorMsgHandler) unregisterSimulatorMsgHandler();
        }
    }, []);

    const onGifRecordStart = () => {
        setRecorderState("recording");
        onRecordStart();
    }

    const screenshotLabel = lf("Take screenshot ({0})", targetTheme.simScreenshotKey);
    const startRecordingLabel = lf("Record game play ({0})", targetTheme.simGifKey);
    const stopRecordingLabel = lf("Stop recording ({0})", targetTheme.simGifKey) ;

    return <div className="gif-recorder">
        <div className="gif-recorder-label">{lf("Pick your project thumbnail")}</div>
        <div className="gif-recorder-actions">
            {!!onScreenshot && <Button className="teal inverted"
                title={screenshotLabel}
                label={screenshotLabel}
                leftIcon="fas fa-camera"
                onClick={onScreenshot} />}
            {!!onRecordStart && <Button className="teal inverted"
                title={recorderState === "recording" ? stopRecordingLabel : startRecordingLabel}
                label={recorderState === "recording" ? stopRecordingLabel : startRecordingLabel}
                leftIcon={`fas fa-${recorderState === "recording" ? "square" : "circle"}`}
                onClick={recorderState === "recording" ? onGifRecordStop : onGifRecordStart} />}
        </div>
    </div>
}