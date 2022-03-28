import * as React from "react";
import { Button } from "../controls/Button";
import { GifRecorder } from "./GifRecorder";

export interface GifInfoProps {
    initialUri?: string;

    onApply: (uri: string) => void;
    onCancel: () => void;

    screenshotAsync?: () => Promise<string>;
    gifRecordAsync?: () => Promise<void>;
    gifRenderAsync?: () => Promise<string | void>;
    gifAddFrame?: (dataUri: ImageData, delay?: number) => boolean;

    registerSimulatorMsgHandler?: (handler: (msg: any) => void) => void;
    unregisterSimulatorMsgHandler?: () => void;
}

export const GifInfo = (props: GifInfoProps) => {
    const { initialUri, onApply, onCancel, screenshotAsync, gifRecordAsync, gifRenderAsync, gifAddFrame,
        registerSimulatorMsgHandler, unregisterSimulatorMsgHandler } = props;
    const [ uri, setUri ] =  React.useState(initialUri);

    const handleApplyClick = (evt?: any) => {
        onApply(uri);
    }

    const handleScreenshotClick = async () => {
        const screenshotUri = await screenshotAsync();
        setUri(screenshotUri);
    }

    const handleRecordStopClick = async () => {
        const gifUri = await gifRenderAsync();
        if (gifUri) setUri(gifUri);
    }

    return <>
        <span className="thumbnail-label">{lf("Current Thumbnail")}</span>
        <div className="thumbnail-image">
            {uri
                ? <img src={uri} />
                : <div className="thumbnail-placeholder" />
            }
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
        <GifRecorder onScreenshot={screenshotAsync ? handleScreenshotClick : undefined}
            onRecordStart={gifRecordAsync}
            onRecordStop={handleRecordStopClick}
            onGifFrame={gifAddFrame}
            registerSimulatorMsgHandler={registerSimulatorMsgHandler}
            unregisterSimulatorMsgHandler={unregisterSimulatorMsgHandler} />
    </>
}