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
import { MultiplayerConfirmation } from "./MultiplayerConfirmation";
import { addGameToKioskAsync } from "./Kiosk";
import { pushNotificationMessage } from "../Notification";
import { classList } from "../util";

const vscodeDevUrl = "https://insiders.vscode.dev/makecode/"

export interface ShareInfoProps {
    projectName: string;
    description?: string;
    screenshotUri?: string;
    isLoggedIn?: boolean;
    hasProjectBeenPersistentShared?: boolean;
    simRecorder: SimRecorder;
    publishAsync: (name: string, screenshotUri?: string, forceAnonymous?: boolean) => Promise<ShareData>;
    isMultiplayerGame?: boolean; // Arcade: Does the game being shared have multiplayer enabled?
    kind?: "multiplayer" | "vscode" | "share"; // Arcade: Was the share dialog opened specifically for hosting a multiplayer game?
    anonymousShareByDefault?: boolean;
    setAnonymousSharePreference?: (anonymousByDefault: boolean) => void;
    onClose: () => void;
}

export const ShareInfo = (props: ShareInfoProps) => {
    const {
        projectName,
        description,
        screenshotUri,
        isLoggedIn,
        simRecorder,
        publishAsync,
        hasProjectBeenPersistentShared,
        anonymousShareByDefault,
        setAnonymousSharePreference,
        isMultiplayerGame,
        kind,
        onClose,
    } = props;
    const [ name, setName ] = React.useState(projectName);
    const [ thumbnailUri, setThumbnailUri ] = React.useState(screenshotUri);
    const [ shareState, setShareState ] = React.useState<"share" | "gifrecord" | "publish" | "publishing">("share");
    const [ shareData, setShareData ] = React.useState<ShareData>();
    const [ embedState, setEmbedState ] = React.useState<"none" | "code" | "editor" | "simulator">("none");
    const [ showQRCode, setShowQRCode ] = React.useState(false);
    const [ copySuccessful, setCopySuccessful ] = React.useState(false);
    const [ kioskSubmitSuccessful, setKioskSubmitSuccessful ] = React.useState(false);
    const [ kioskState, setKioskState ] = React.useState(false);
    const [ isAnonymous, setIsAnonymous ] = React.useState(!isLoggedIn || anonymousShareByDefault);
    const [ isShowingMultiConfirmation, setIsShowingMultiConfirmation ] = React.useState(false);

    const { simScreenshot, simGif } = pxt.appTarget.appTheme;
    const showSimulator = (simScreenshot || simGif) && !!simRecorder;
    const showDescription = shareState !== "publish";
    let qrCodeButtonRef: HTMLButtonElement;
    let inputRef: HTMLInputElement;
    let kioskInputRef: HTMLInputElement;

    React.useEffect(() => {
        setThumbnailUri(screenshotUri)
    }, [screenshotUri])

    React.useEffect(() => {
        if (isLoggedIn) {
            pxt.tickEvent("share.open.loggedIn", { state: shareState, anonymous: isAnonymous?.toString(), persistent: hasProjectBeenPersistentShared?.toString() });
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

    const handlePublishInVscodeClick = async () => {
        setShareState("publishing");
        let publishedShareData = await publishAsync(name, thumbnailUri, isAnonymous);
        setShareData(publishedShareData);
        if (!publishedShareData?.error) {
            setShareState("publish");

            pxt.tickEvent(`share.openInVscode`);
            window.open(vscodeDevUrl + publishedShareData.url.split("/").pop(), "_blank");
        }
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

    const handleKioskSubmitBlur = () => {
        setKioskSubmitSuccessful(false);
    }

    const handleKioskSubmitClick = async () => {
        pxt.tickEvent("share.kiosk.submitClicked");
        const gameId = pxt.Cloud.parseScriptId(shareData.url);
        if (kioskInputRef?.value) {
            let validKioskId = /^[a-zA-Z0-9]{6}$/.exec(kioskInputRef.value)?.[0];
            if (validKioskId) {
                validKioskId = validKioskId.toUpperCase();
                setKioskSubmitSuccessful(true);
                try {
                    await addGameToKioskAsync(validKioskId, gameId);
                    pxt.tickEvent("share.kiosk.submitSuccessful");
                    pushNotificationMessage({
                        kind: 'info',
                        text: lf("Game submitted to kiosk {0} successfully!", validKioskId),
                        hc: false
                    })

                } catch (error) {
                    pxt.tickEvent("share.kiosk.submitServerError");
                    if (error.message === "Not Found") {
                        pushNotificationMessage({
                            kind: 'err',
                            text: lf("Kiosk Code not found"),
                            hc: false
                        });
                    } else {
                        pushNotificationMessage({
                            kind: 'err',
                            text: lf("Something went wrong submitting game to kiosk {0}", validKioskId),
                            hc: false
                        });
                    }
                }
            } else {
                pushNotificationMessage({
                    kind: 'err',
                    text: lf("Invalid format for Kiosk Code"),
                    hc: false
                });
            }
        } else {
            pushNotificationMessage({
                kind: 'err',
                text: lf("Input a six-character kiosk Code"),
                hc: false
            });
        }
    }

    const handleEmbedClick = () => {
        if (embedState === "none") {
            pxt.tickEvent(`share.embed`);
            setShowQRCode(false);
            setKioskState(false);
            setEmbedState("code");
        } else {
            setEmbedState("none");
        }
    }

    const handleKioskClick = () => {
        if (!kioskState) {
            pxt.tickEvent(`share.kiosk`);
            setEmbedState("none");
            setShowQRCode(false);
            setKioskState(true);
        } else {
            setKioskState(false);
        }
    }

    const handleKioskHelpClick = () => {
        const kioskDocumentationUrl = "https://arcade.makecode.com/hardware/kiosk";
        window.open(kioskDocumentationUrl, "_blank");
    }

    const handleQRCodeClick = () => {
        pxt.tickEvent('share.qrtoggle');
        if (!showQRCode) {
            setEmbedState("none");
            setShowQRCode(true);
            setKioskState(false);
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

    const handleMultiplayerShareConfirmClick = async () => {
        setShareState("publishing");
        setIsShowingMultiConfirmation(false);

        const publishedShareData = await publishAsync(name, thumbnailUri, isAnonymous);

        // TODO multiplayer: This won't work on staging (parseScriptId domains check doesn't include staging urls)
        // but those wouldn't load anyways (as staging multiplayer is currently fetching games from prod links)
        const shareId = pxt.Cloud.parseScriptId(publishedShareData.url);
        if (!shareId) {
            pxt.tickEvent(`share.hostMultiplayerError`);
            return;
        }

        const multiplayerHostUrl = pxt.multiplayer.makeHostLink(shareId, false);

        // NOTE: It is allowable to log the shareId here because this is within the multiplayer context.
        // In this context, the user has consented to allowing the shareId being made public.
        pxt.tickEvent(`share.hostMultiplayerShared`, { shareId });
        window.open(multiplayerHostUrl, "_blank");

        setShareData(publishedShareData);
        if (!publishedShareData?.error) setShareState("publish");
        else setShareState("share")

        if (kind === "multiplayer") {
            // If we're in the "for multiplayer" context, we want to close the share dialog after launching the multiplayer session.
            onClose();
        }
    }

    const handleMultiplayerShareClick = async () => {
        setIsShowingMultiConfirmation(true);
        pxt.tickEvent(`share.hostMultiplayer`);
    }

    const handleMultiplayerShareCancelClick = async () => {
        setIsShowingMultiConfirmation(false);
        pxt.tickEvent(`share.hostMultiplayerCancel`);
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

    const handleKioskInputRef = (ref: HTMLInputElement) => {
        if (ref) kioskInputRef = ref;
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
                                {pxt.appTarget?.appTheme?.multiplayer && (isMultiplayerGame || kind === "multiplayer") &&
                                    <Button className={
                                            classList(
                                                "primary share-host-button",
                                                kind === "share" && "primary inverted text-only",
                                                kind === "multiplayer" && "share-publish-button"
                                            )
                                        }
                                        title={lf("Host a multiplayer game")}
                                        label={lf("Host a multiplayer game")}
                                        leftIcon={"xicon multiplayer"}
                                        onClick={handleMultiplayerShareClick} />
                                }
                                {kind === "share" && <Button className="primary share-publish-button"
                                        title={lf("Share Project")}
                                        label={lf("Share Project")}
                                        onClick={handlePublishClick} />
                                }
                                {kind === "vscode" && <Button className="primary share-publish-button"
                                        title={lf("Open in VS Code")}
                                        label={lf("Open in VS Code")}
                                        onClick={handlePublishInVscodeClick} />
                                }
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
                                    {
                                        pxt.appTarget?.appTheme?.shareToKiosk &&
                                            <Button className="square-button gray mobile-portrait-hidden"
                                            title={lf("Share to MakeCode Arcade Kiosk")}
                                            leftIcon={"xicon kiosk"}
                                            onClick={handleKioskClick} />
                                    }
                                    {
                                        navigator.share && <Button className="square-button device-share"
                                            title={lf("Show device share options")}
                                            ariaLabel={lf("Show device share options")}
                                            leftIcon={"icon share"}
                                            onClick={handleDeviceShareClick} />
                                    }
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
                    {kioskState &&
                        <div>
                            <div className="project-share-label">
                                {lf("Enter Kiosk Code")}
                                <Button className="link-button kiosk"
                                        title={lf("Learn more about Kiosk")}
                                        leftIcon="far fa-question-circle"
                                        onClick={handleKioskHelpClick} />
                            </div>
                            <div className="common-input-attached-button">
                                <Input
                                    handleInputRef={handleKioskInputRef}
                                    ariaDescribedBy="share-input-title"
                                    preserveValueOnBlur={true}
                                    placeholder="A12B3C"
                                />
                                <Button className={kioskSubmitSuccessful ? "green" : "primary"}
                                    title={lf("Submit Kiosk Code")}
                                    label={kioskSubmitSuccessful ? lf("Submitted!") : lf("Submit")}
                                    onClick={handleKioskSubmitClick}
                                    onBlur={handleKioskSubmitBlur} />
                            </div>
                        </div>

                    }
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
            {isShowingMultiConfirmation &&
                <MultiplayerConfirmation
                    onCancelClicked={handleMultiplayerShareCancelClick}
                    onConfirmClicked={handleMultiplayerShareConfirmClick} />
            }
        </div>
    </>
}