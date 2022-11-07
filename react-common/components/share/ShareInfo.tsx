import * as React from "react";
import { Button } from "../controls/Button";
import { EditorToggle } from "../controls/EditorToggle";
import { Input } from "../controls/Input";
import { Textarea } from "../controls/Textarea";
import { Modal } from "../controls/Modal";

import { ShareData } from "./Share";
import { ThumbnailRecorder } from "./ThumbnailRecorder";
import { SocialButton } from "./SocialButton";
import { Checkbox } from "../controls/Checkbox";
import { SimRecorder } from "./ThumbnailRecorder";

export interface ShareInfoProps {
    projectName: string;
    description?: string;
    screenshotUri?: string;
    isLoggedIn?: boolean;
    hasProjectBeenPersistentShared?: boolean;
    simRecorder: SimRecorder;
    publishAsync: (name: string, screenshotUri?: string, forceAnonymous?: boolean) => Promise<ShareData>;
    isMultiplayerGame?: boolean;

    anonymousShareByDefault?: boolean;
    setAnonymousSharePreference?: (anonymousByDefault: boolean) => void;
}

export const ShareInfo = (props: ShareInfoProps) => {
    const { projectName, description, screenshotUri, isLoggedIn, simRecorder, publishAsync, hasProjectBeenPersistentShared, anonymousShareByDefault, setAnonymousSharePreference, isMultiplayerGame } = props;
    const [ name, setName ] = React.useState(projectName);
    const [ thumbnailUri, setThumbnailUri ] = React.useState(screenshotUri);
    const [ shareState, setShareState ] = React.useState<"share" | "gifrecord" | "publish" | "publishing">("share");
    const [ shareData, setShareData ] = React.useState<ShareData>();
    const [ embedState, setEmbedState ] = React.useState<"none" | "code" | "editor" | "simulator">("none");
    const [ showQRCode, setShowQRCode ] = React.useState(false);
    const [ copySuccessful, setCopySuccessful ] = React.useState(false);
    const [ isAnonymous, setIsAnonymous ] = React.useState(!isLoggedIn || anonymousShareByDefault);

    const showSimulator = !!simRecorder;
    const showDescription = shareState !== "publish";
    let qrCodeButtonRef: HTMLButtonElement;
    let inputRef: HTMLInputElement;

    React.useEffect(() => {
        setThumbnailUri(screenshotUri)
    }, [screenshotUri])

    React.useEffect(() => {
        if (isLoggedIn) {
            pxt.tickEvent("share.open.loggedIn", { state: shareState, anonymous: isAnonymous.toString(), persistent: hasProjectBeenPersistentShared.toString() });
        } else {
            pxt.tickEvent("share.open", { state: shareState});
        }
    }, [shareState, isAnonymous, hasProjectBeenPersistentShared]);

    const exitGifRecord = () => {
        setShareState("share");
    }

    const applyGifChange = (uri: string) => {
        setThumbnailUri(uri);
        exitGifRecord();
    }

    const handlePublishClick = async () => {
        setShareState("publishing");
        let publishedShareData = await publishAsync(name, thumbnailUri, isAnonymous);
        setShareData(publishedShareData);
        if (!publishedShareData?.error) setShareState("publish");
        else setShareState("share")
    }

    const handleCopyClick = () => {
        if (pxt.BrowserUtils.isIpcRenderer()) {
            setCopySuccessful(pxt.BrowserUtils.legacyCopyText(inputRef));
        }
        else {
            navigator.clipboard.writeText(shareData.url);
            setCopySuccessful(true);
        }
    }

    const handleCopyBlur = () => {
        setCopySuccessful(false);
    }

    const handleEmbedClick = () => {
        if (embedState === "none") {
            pxt.tickEvent(`share.embed`);
            setShowQRCode(false);
            setEmbedState("code");
        } else {
            setEmbedState("none");
        }
    }

    const handleQRCodeClick = () => {
        pxt.tickEvent('share.qrtoggle');
        if (!showQRCode) {
            setEmbedState("none");
            setShowQRCode(true);
        } else {
            setShowQRCode(false);
        }
    }

    const handleDeviceShareClick = async () => {
        pxt.tickEvent("share.device");

        const shareOpts = {
            title: document.title,
            url: shareData.url,
            text: lf("Check out my new MakeCode project!"),
        };

        // TODO: Fix this; typing for navigator not included in the lib typing we use in tsconfig
        if ((navigator as any)?.canShare?.(shareOpts)) {
            return navigator.share(shareOpts);
        }
    };

    const handleMultiplayerShareClick = async () => {
        const publishedShareData = await publishAsync(name, thumbnailUri, isAnonymous);

        // TODO multiplayer: This won't work on staging (parseScriptId domains check doesn't include staging urls)
        // but those wouldn't load anyways (as staging multiplayer is currently fetching games from prod links)
        const shareId = pxt.Cloud.parseScriptId(publishedShareData.url);
        if (!shareId)
            return;

        const domain = pxt.BrowserUtils.isLocalHostDev() ? "http://localhost:3000" : "";
        const multiplayerHostUrl = `${domain}${pxt.webConfig.relprefix}multiplayer?host=${shareId}`;

        pxt.tickEvent(`share.multiplayer`);
        window.open(multiplayerHostUrl, "_blank");
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

    const handleQRCodeButtonRef = (ref: HTMLButtonElement) => {
        if (ref) qrCodeButtonRef = ref;
    }

    const handleQRCodeModalClose = () => {
        setShowQRCode(false);
        if (qrCodeButtonRef) qrCodeButtonRef.focus();
    }

    const handleInputRef = (ref: HTMLInputElement) => {
        if (ref) inputRef = ref;
    }

    const handleAnonymousShareClick = (newValue: boolean) => {
        pxt.tickEvent("share.persistentCheckbox", { checked: newValue.toString() });
        setIsAnonymous(!newValue);
        if (setAnonymousSharePreference) setAnonymousSharePreference(!newValue);
    }

    const prePublish = shareState === "share" || shareState === "publishing";

    const inputTitle = prePublish ? lf("Project Title") : lf("Project Link")

    return <>
        <div className="project-share-info">
            {showSimulator && shareState !== "gifrecord" &&
                <div className="project-share-thumbnail">
                    {thumbnailUri
                        ? <img src={thumbnailUri} />
                        : <div className="project-thumbnail-placeholder">
                             <div className="common-spinner" />
                        </div>
                    }
                    {shareState !== "publish" &&
                        <Button
                            className="link-button"
                            title={lf("Update project thumbnail")}
                            label={lf("Update project thumbnail")}
                            onClick={() => setShareState("gifrecord")} />
                    }
                </div>
            }
            <div className="project-share-content">
                {(prePublish || shareState === "publish") && <>
                    <div className="project-share-title project-share-label" id="share-input-title">
                        {inputTitle}
                    </div>
                    {showDescription && <>
                        <Input
                            ariaDescribedBy="share-input-title"
                            className="name-input"
                            initialValue={name}
                            placeholder={lf("Name your project")}
                            onChange={setName} />
                        {isLoggedIn && hasProjectBeenPersistentShared && <Checkbox
                            id="persistent-share-checkbox"
                            label={lf("Update existing share link for this project")}
                            isChecked={!isAnonymous}
                            onChange={handleAnonymousShareClick}
                            />}
                        </>
                    }
                    {prePublish && <>
                        {shareData?.error && <div className="project-share-error">
                            {(shareData.error.statusCode === 413
                                && pxt.appTarget?.cloud?.cloudProviders?.github)
                                ? lf("Oops! Your project is too big. You can create a GitHub repository to share it.")
                                : lf("Oops! There was an error. Please ensure you are connected to the Internet and try again.")}
                        </div>}
                        <div className="project-share-publish-actions">
                            {shareState === "share" &&
                            <>
                                {pxt.appTarget?.appTheme?.multiplayerShareButton && isMultiplayerGame &&
                                    <Button className="primary inverted text-only"
                                        title={lf("Host a multiplayer game")}
                                        label={lf("Host a multiplayer game")}
                                        leftIcon={"fas fa-people-arrows"}
                                        onClick={handleMultiplayerShareClick} />
                                }
                                <Button className="primary share-publish-button"
                                        title={lf("Share Project")}
                                        label={lf("Share Project")}
                                        onClick={handlePublishClick} />
                            </>
                            }
                            { shareState === "publishing" &&
                                <Button className="primary share-publish-button"
                                    title={lf("Publishing...")}
                                    label={ <div className="common-spinner" />}
                                    onClick={() => {}} />
                            }
                        </div>
                    </>}

                    {shareState === "publish" &&
                        <div className="project-share-data">
                            <div className="common-input-attached-button">
                                <Input
                                    ariaDescribedBy="share-input-title"
                                    handleInputRef={handleInputRef}
                                    initialValue={shareData.url}
                                    readOnly={true}
                                    onChange={setName} />
                                <Button className={copySuccessful ? "green" : "primary"}
                                    title={lf("Copy link")}
                                    label={copySuccessful ? lf("Copied!") : lf("Copy")}
                                    leftIcon="fas fa-link"
                                    onClick={handleCopyClick}
                                    onBlur={handleCopyBlur} />
                            </div>
                            <div className="project-share-actions">
                                <div className="project-share-social">
                                    <Button className="square-button gray embed mobile-portrait-hidden"
                                        title={lf("Show embed code")}
                                        leftIcon="fas fa-code"
                                        onClick={handleEmbedClick} />
                                    <SocialButton className="square-button facebook"
                                        url={shareData?.url}
                                        type='facebook'
                                        heading={lf("Share on Facebook")} />
                                    <SocialButton className="square-button twitter"
                                        url={shareData?.url}
                                        type='twitter'
                                        heading={lf("Share on Twitter")} />
                                    <SocialButton className="square-button google-classroom"
                                        url={shareData?.url}
                                        type='google-classroom'
                                        heading={lf("Share on Google Classroom")} />
                                    <SocialButton className="square-button microsoft-teams"
                                        url={shareData?.url}
                                        type='microsoft-teams'
                                        heading={lf("Share on Microsoft Teams")} />
                                    <SocialButton className="square-button whatsapp"
                                        url={shareData?.url}
                                        type='whatsapp'
                                        heading={lf("Share on WhatsApp")} />
                                    {navigator.share && <Button className="square-button device-share"
                                        title={lf("Show device share options")}
                                        ariaLabel={lf("Show device share options")}
                                        leftIcon={"icon share"}
                                        onClick={handleDeviceShareClick}
                                    />}
                                </div>
                                <Button
                                    className="menu-button project-qrcode"
                                    buttonRef={handleQRCodeButtonRef}
                                    title={lf("Show QR Code")}
                                    label={<img className="qrcode-image" src={shareData?.qr} />}
                                    onClick={handleQRCodeClick}
                                />
                            </div>
                        </div>
                    }
                    {embedState !== "none" && <div className="project-embed">
                        <EditorToggle id="project-embed-toggle"
                            className="slim tablet-compact"
                            items={embedOptions}
                            selected={embedOptions.findIndex(i => i.name === embedState)} />
                        <Textarea readOnly={true}
                            rows={5}
                            initialValue={shareData?.embed[embedState]} />
                    </div>}
                </>}
                {shareState === "gifrecord" && <ThumbnailRecorder
                    initialUri={thumbnailUri}
                    onApply={applyGifChange}
                    onCancel={exitGifRecord}
                    simRecorder={simRecorder}/>}
            </div>

            {showQRCode &&
                <Modal title={lf("QR Code")} onClose={handleQRCodeModalClose}>
                    <div className="qrcode-modal-body">
                        <img className="qrcode-image" src={shareData?.qr} />
                    </div>
                </Modal>
            }
        </div>
    </>
}