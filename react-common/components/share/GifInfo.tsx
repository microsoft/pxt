import * as React from "react";
import { Button } from "../controls/Button";

export interface GifInfoProps {
    initialUri?: string;

    onApply: (uri: string) => void;
    onCancel: () => void;

    simRecorder: SimRecorder;
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
    addStateChangeListener: (handler: (newState: SimRecorderState) => void) => void;
    addThumbnailListener: (handler: (uri: string, type: "gif" | "png") => void) => void;
    removeStateChangeListener: (handler: (newState: SimRecorderState) => void) => void;
    removeThumbnailListener: (handler: (uri: string, type: "gif" | "png") => void) => void;
}


export const GifInfo = (props: GifInfoProps) => {
    const { initialUri, onApply, onCancel, simRecorder } = props;
    const [ uri, setUri ] =  React.useState(initialUri);
    const [ recorderRef, setRecorderRef ] = React.useState<SimRecorderRef>(undefined);
    const [ recorderState, setRecorderState ] = React.useState<SimRecorderState>("default");

    React.useEffect(() => {
        if (!recorderRef) return undefined;
        recorderRef.addStateChangeListener(setRecorderState);
        recorderRef.addThumbnailListener(setUri);

        return () => {
            recorderRef.removeStateChangeListener(setRecorderState);
            recorderRef.removeThumbnailListener(setUri);
        }
    }, [recorderRef])

    const handleApplyClick = (evt?: any) => {
        onApply(uri);
    }

    const handleScreenshotClick = async () => {
        if (recorderRef) recorderRef.screenshotAsync();
    }

    const handleRecordClick = async () => {
        if (!recorderRef) return;

        if (recorderRef.state === "recording") {
            recorderRef.stopRecordingAsync();
        }
        else if (recorderRef.state === "default") {
            recorderRef.startRecordingAsync();
        }
    }

    const targetTheme = pxt.appTarget.appTheme;

    const handleSimRecorderRef = (ref: SimRecorderRef) => {
        setRecorderRef(ref);
    }

    const screenshotLabel = lf("Take screenshot ({0})", targetTheme.simScreenshotKey);
    const startRecordingLabel = lf("Record game play ({0})", targetTheme.simGifKey);
    const stopRecordingLabel = lf("Stop recording ({0})", targetTheme.simGifKey) ;

    return <>
        <span className="thumbnail-label">{lf("Current Thumbnail")}</span>
        {/* <div className="thumbnail-image">
            {uri
                ? <img src={uri} />
                : <div className="thumbnail-placeholder" />
            }
        </div> */}
        {React.createElement(simRecorder, { onSimRecorderInit: handleSimRecorderRef })}
        <div className="thumbnail-actions">
            <Button className="primary"
                title={lf("Apply")}
                label={lf("Apply")}
                onClick={handleApplyClick} />
            <Button title={lf("Cancel")}
                label={lf("Cancel")}
                onClick={onCancel} />
        </div>

        <div className="gif-recorder">
            <div className="gif-recorder-label">{lf("Pick your project thumbnail")}</div>
            <div className="gif-recorder-actions">
                {<Button className="teal inverted"
                    title={screenshotLabel}
                    label={screenshotLabel}
                    leftIcon="fas fa-camera"
                    onClick={handleScreenshotClick} />}
                {<Button className="teal inverted"
                    title={recorderState === "recording" ? stopRecordingLabel : startRecordingLabel}
                    label={recorderState === "recording" ? stopRecordingLabel : startRecordingLabel}
                    leftIcon={`fas fa-${recorderState === "recording" ? "square" : "circle"}`}
                    onClick={handleRecordClick} />}
            </div>
        </div>
    </>
}