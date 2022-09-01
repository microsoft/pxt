import * as React from "react";
import { Button } from "../controls/Button";
import { SimRecorder, SimRecorderRef, SimRecorderState } from "./GifRecorder";

export interface GifInfoProps {
    initialUri?: string;

    onApply: (uri: string) => void;
    onCancel: () => void;

    simRecorder: SimRecorder;
}

export const GifInfo = (props: GifInfoProps) => {
    const { initialUri, onApply, onCancel, simRecorder } = props;
    const [ uri, setUri ] =  React.useState(initialUri);
    const [ recorderRef, setRecorderRef ] = React.useState<SimRecorderRef>(undefined);
    const [ recorderState, setRecorderState ] = React.useState<SimRecorderState>("default");

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
        ref.onStateChange(setRecorderState);
        ref.onThumbnail((uri, type) => setUri(uri));
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