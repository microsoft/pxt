import * as React from "react";
import { Button } from "../controls/Button";


export interface GifRecorderProps {
    onScreenshot?: () => void;
    onRecordStart?: () => void;
    onRecordStop?: () => Promise<void>;
}

export const GifRecorder = (props: GifRecorderProps) => {
    const { onScreenshot, onRecordStart, onRecordStop } = props;
    const [ recorderState, setRecorderState ] = React.useState<"default" | "recording" | "rendering">("default");

    const onGifRecordStart = () => {
        setRecorderState("recording");
        onRecordStart();
    }

    const onGifRecordStop = async () => {
        setRecorderState("rendering");
        await onRecordStop();
        setRecorderState("default");
    }

    return <div className="gif-recorder">
        <div className="gif-recorder-label">{lf("Pick your project thumbnail")}</div>
        <div className="gif-recorder-actions">
            {!!onScreenshot && <Button className="teal inverted"
                title={lf("Take screenshot")}
                label={lf("Take screenshot")}
                leftIcon="fas fa-camera"
                onClick={onScreenshot} />}
            {!!onRecordStart && <Button className="teal inverted"
                title={recorderState === "recording" ? lf("Stop recording") : lf("Record game play")}
                label={recorderState === "recording" ? lf("Stop recording") : lf("Record game play")}
                leftIcon={`fas fa-${recorderState === "recording" ? "square" : "circle"}`}
                onClick={recorderState === "recording" ? onGifRecordStop : onGifRecordStart} />}
        </div>
    </div>
}