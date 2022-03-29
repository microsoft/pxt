import * as React from "react";
import { Button } from "../controls/Button";
import { EditorToggle } from "../controls/EditorToggle";
import { Input } from "../controls/Input";
import { Textarea } from "../controls/Textarea";

import { ShareData } from "./Share";
import { GifInfo } from "./GifInfo";
import { SocialButton } from "./SocialButton";

export interface ShareInfoProps {
    projectName: string;
    description?: string;
    screenshotUri?: string;

    screenshotAsync?: () => Promise<string>;
    gifRecordAsync?: () => Promise<void>;
    gifRenderAsync?: () => Promise<string | void>;
    gifAddFrame?: (dataUri: ImageData, delay?: number) => boolean;
    publishAsync: (name: string, screenshotUri?: string) => Promise<ShareData>;
    registerSimulatorMsgHandler?: (handler: (msg: any) => void) => void;
    unregisterSimulatorMsgHandler?: () => void;
}

export const ShareInfo = (props: ShareInfoProps) => {
    const { projectName, description, screenshotUri, screenshotAsync, gifRecordAsync, gifRenderAsync, gifAddFrame,
        publishAsync, registerSimulatorMsgHandler, unregisterSimulatorMsgHandler } = props;
    const [ name, setName ] = React.useState(projectName);
    const [ thumbnailUri, setThumbnailUri ] = React.useState(screenshotUri);
    const [ shareState, setShareState ] = React.useState<"share" | "gifrecord" | "publish">("share");
    const [ shareData, setShareData ] = React.useState<ShareData>();
    const [ embedState, setEmbedState ] = React.useState<"none" | "code" | "editor" | "simulator">("none");
    const [ showQRCode, setShowQRCode ] = React.useState(false);

    const showSimulator = !!screenshotAsync || !!gifRecordAsync;

    React.useEffect(() => {
        setThumbnailUri(screenshotUri)
    }, [screenshotUri])

    const exitGifRecord = () => {
        setShareState("share");
    }

    const applyGifChange = (uri: string) => {
        setThumbnailUri(uri);
        exitGifRecord();
    }

    const handlePublishClick = async () => {
        let publishedShareData = await publishAsync(name, thumbnailUri);
        setShareData(publishedShareData);
        if (!publishedShareData?.error) setShareState("publish");
    }

    const handleCopyClick = () => {
        navigator.clipboard.writeText(shareData.url);
    }

    const handleEmbedClick = () => {
        if (embedState === "none") {
            setShowQRCode(false);
            setEmbedState("code");
        } else {
            setEmbedState("none");
        }
    }

    const handleQRCodeClick = () => {
        if (!showQRCode) {
            setEmbedState("none");
            setShowQRCode(true);
        } else {
            setShowQRCode(false);
        }
    }


    const embedOptions = [{
        name: "code",
        label: lf("Code"),
        title: lf("Code"),
        focusable: true,
        onClick: () => setEmbedState("code")
    },
    {
        name: "editor",
        label: lf("Editor"),
        title: lf("Editor"),
        focusable: true,
        onClick: () => setEmbedState("editor")
    },
    {
        name: "simulator",
        label: lf("Simulator"),
        title: lf("Simulator"),
        focusable: true,
        onClick: () => setEmbedState("simulator")
    }];

    return <>
        <div className="project-share-info">
            {(shareState === "share" || shareState === "publish") && <>
                {showSimulator && <h2>{lf("About your project")}</h2>}
                <Input label={lf("Project Name")}
                    initialValue={name}
                    placeholder={lf("Name your project")}
                    readOnly={shareState === "publish"}
                    onChange={setName} />
                <Textarea label={lf("Description")}
                    initialValue={description}
                    placeholder={lf("Tell others about your game")}
                    readOnly={shareState === "publish"}
                    rows={5} />
                {shareState === "share" && <>
                    {showSimulator && <div className="project-share-thumbnail">
                        {thumbnailUri
                            ? <img src={thumbnailUri} />
                            : <div className="project-thumbnail-placeholder" />
                        }
                        <Button title={lf("Update project thumbnail")}
                            label={lf("Update project thumbnail")}
                            onClick={() => setShareState("gifrecord")} />
                    </div>}
                    <div>{lf("By publishing you agree that you are allowed to share this game.")}</div>
                    {shareData?.error && <div className="project-share-error">
                        {(shareData.error.statusCode === 413
                            && pxt.appTarget?.cloud?.cloudProviders?.github)
                            ? lf("Oops! Your project is too big. You can create a GitHub repository to share it.")
                            : lf("Oops! There was an error. Please ensure you are connected to the Internet and try again.")}
                    </div>}
                    <Button className="primary"
                        title={lf("Publish to share")}
                        label={lf("Publish to share")}
                        onClick={handlePublishClick} />
                </>}
                {shareState === "publish" && <div className="project-share-actions">
                    <Button className="teal"
                        title={lf("Copy link")}
                        label={lf("Copy link")}
                        leftIcon="fas fa-link"
                        onClick={handleCopyClick} />
                    <Button className="share-button"
                        title={lf("Show QR code")}
                        leftIcon="fas fa-qrcode"
                        onClick={handleQRCodeClick} />
                    <Button className="share-button"
                        title={lf("Show embed code")}
                        leftIcon="fas fa-code"
                        onClick={handleEmbedClick} />
                    <SocialButton className="share-button"
                        url={shareData?.url}
                        type='facebook'
                        heading={lf("Share on Facebook")} />
                    <SocialButton className="share-button"
                        url={shareData?.url}
                        type='twitter'
                        heading={lf("Share on Twitter")} />
                </div>}
                {embedState !== "none" && <div className="project-embed">
                    <EditorToggle id="project-embed-toggle"
                        className="slim tablet-compact"
                        items={embedOptions}
                        selected={embedOptions.findIndex(i => i.name === embedState)} />
                    <Textarea readOnly={true}
                        rows={5}
                        initialValue={shareData?.embed[embedState]} />
                </div>}
                {showQRCode && <div className="project-qrcode">
                    <img src={shareData?.qr} />
                </div>}
            </>}
            {shareState === "gifrecord" && <GifInfo
                initialUri={thumbnailUri}
                onApply={applyGifChange}
                onCancel={exitGifRecord}
                screenshotAsync={screenshotAsync}
                gifRecordAsync={gifRecordAsync}
                gifRenderAsync={gifRenderAsync}
                gifAddFrame={gifAddFrame}
                registerSimulatorMsgHandler={registerSimulatorMsgHandler}
                unregisterSimulatorMsgHandler={unregisterSimulatorMsgHandler} />}
        </div>
    </>
}