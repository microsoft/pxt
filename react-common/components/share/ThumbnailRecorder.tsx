import * as React from "react";
import { Button } from "../controls/Button";

export interface ThumbnailRecorderProps {
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
    addErrorListener: (handler: (message: string) => void) => void;
    removeStateChangeListener: (handler: (newState: SimRecorderState) => void) => void;
    removeThumbnailListener: (handler: (uri: string, type: "gif" | "png") => void) => void;
    removeErrorListener: (handler: (message: string) => void) => void;
}


export const ThumbnailRecorder = (props: ThumbnailRecorderProps) => {
    const { initialUri, onApply, onCancel, simRecorder } = props;
    const [ uri, setUri ] =  React.useState(initialUri);
    const [ error, setError] = React.useState<string>(undefined)
    const [ recorderRef, setRecorderRef ] = React.useState<SimRecorderRef>(undefined);
    const [ recorderState, setRecorderState ] = React.useState<SimRecorderState>("default");

    React.useEffect(() => {
        if (!recorderRef) return undefined;
        recorderRef.addStateChangeListener(setRecorderState);
        recorderRef.addThumbnailListener(setUri);
        recorderRef.addErrorListener(setError);

        return () => {
            recorderRef.removeStateChangeListener(setRecorderState);
            recorderRef.removeThumbnailListener(setUri);
            recorderRef.removeErrorListener(setError);
        }
    }, [recorderRef])

    const handleApplyClick = (evt?: any) => {
        onApply(uri);
    }

    const handleScreenshotClick = async () => {
        setError(undefined);
        if (recorderRef) recorderRef.screenshotAsync();
    }

    const handleRecordClick = async () => {
        setError(undefined);
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
    const startRecordingLabel = lf("Record gameplay ({0})", targetTheme.simGifKey);
    const stopRecordingLabel = lf("Stop recording ({0})", targetTheme.simGifKey) ;

    return <>
        <div className="gif-recorder-content">
            <div className="gif-recorder-sim-embed">
                {React.createElement(simRecorder, { onSimRecorderInit: handleSimRecorderRef })}
            </div>
            <div className="thumbnail-controls">
                <div className="thumbnail-preview">
                    <div>
                        <span className="thumbnail-label">{lf("Current Thumbnail")}</span>
                        <div className="thumbnail-image">
                            {initialUri
                                ? <img src={initialUri} />
                                : <div className="thumbnail-placeholder" />
                            }
                        </div>
                    </div>
                    <div>
                        <span className="thumbnail-label">{lf("New Thumbnail")}</span>
                        <div className="thumbnail-image">
                            {uri
                                ? <img src={uri} />
                                : <div className="thumbnail-placeholder" />
                            }
                        </div>
                    </div>
                </div>
                <div className="thumbnail-actions">
                    <Button className="primary"
                        title={lf("Apply")}
                        label={lf("Apply")}
                        onClick={handleApplyClick} />
                    <Button title={lf("Cancel")}
                        label={lf("Cancel")}
                        onClick={onCancel} />
                </div>
            </div>
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