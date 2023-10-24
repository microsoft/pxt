import { useEffect, useRef, useState } from "react";
import { play, stopScan } from "./QrScanner";
import { canthrow_addGameToKioskAsync } from "../Services/BackendRequests";
import { KioskState } from "../Types";
import { Html5Qrcode } from "html5-qrcode";
import ErrorModal from "./ErrorModal";
import { navigate } from "../Transforms/navigate";
import { useMakeNavigable } from "../Hooks";
import GenericButton from "./GenericButton";
import * as GamepadManager from "../Services/GamepadManager";
import { Button } from "../../../react-common/components/controls/Button";

interface IProps {}

const ScanQR: React.FC<IProps> = ({}) => {
    const fullUrlHash = window.location.hash;
    const urlHashList = /add-game:((?:[a-zA-Z0-9]{6}))/.exec(fullUrlHash);
    const kioskId = urlHashList?.[1];
    const [scannerVisible, setScannerVisible] = useState(false);
    const [linkError, setLinkError] = useState(false);
    const [addingError, setAddingError] = useState("");
    const [errorDesc, setErrorDesc] = useState("");
    const qrReaderRendered = useRef(null);
    const [html5QrCode, setHtml5QrCode] = useState<undefined | Html5Qrcode>();

    const renderQrScanner = () => {
        pxt.tickEvent("kiosk.scanQrClicked");
        play(kioskId!, html5QrCode!, setAddingError, setErrorDesc);
        setScannerVisible(true);
    };

    const stopQrScanner = () => {
        pxt.tickEvent("kiosk.stopScanClicked");
        stopScan(html5QrCode!);
        setScannerVisible(false);
    };

    const initiateQrCode = () => {
        if (qrReaderRendered.current) {
            const qrCodeReader = new Html5Qrcode("qrReader");
            setHtml5QrCode(qrCodeReader);
        }
    };

    const clickHelp = () => {
        pxt.tickEvent("kiosk.helpLink");
        return true;
    };

    useEffect(() => {
        pxt.tickEvent("kiosk.scanQrLoaded");
        initiateQrCode();
    }, []);

    useEffect(() => {
        // Disallow keyboard navigation because this page has a text input
        GamepadManager.setVirtualGamepadsEnabled(false);
        return () => GamepadManager.setVirtualGamepadsEnabled(true);
    }, []);

    const checkUrl = async () => {
        const input = document.getElementById(
            "kiosk-share-link"
        ) as HTMLInputElement;
        const inputValue = input.value?.trim();
        const shareLink =
            /^(https:\/\/)((arcade\.makecode\.com\/)|(makecode\.com\/))((?:S?\d{5}-\d{5}-\d{5}-\d{5})$|(?:_[a-zA-Z0-9]+)$)/i.exec(
                inputValue
            );
        const shareCode =
            /(^(?:S?\d{5}-\d{5}-\d{5}-\d{5})$|^(?:_[a-zA-Z0-9]{12})$)/.exec(
                inputValue
            );
        let shareId;
        if (shareLink) {
            shareId = /\/([^\/]+)\/?$/.exec(inputValue)?.[1];
        } else if (shareCode) {
            shareId = shareCode[1];
        }
        pxt.tickEvent("kiosk.submitGameId.clicked", { submitVal: inputValue });
        if (shareId) {
            setLinkError(false);
            try {
                await canthrow_addGameToKioskAsync(kioskId, shareId);
                pxt.tickEvent("kiosk.submitGameId.submitSuccess");
                navigate(KioskState.QrSuccess);
            } catch (error: any) {
                setAddingError(error.toString());
                if (error.toString().includes("404")) {
                    setErrorDesc(
                        lf("The kiosk code expired. Go back to the kiosk to make a new code.")
                    );
                } else {
                    setErrorDesc(
                        lf("Something went wrong. Please try again later.")
                    );
                }
            }
        } else {
            setLinkError(true);
        }
    };

    const clearStatus = () => {
        if (linkError) {
            setLinkError(false);
        }
    };

    const [submitRef, setSubmitRef] = useState<HTMLInputElement | null>(null);
    const handleSubmitRef = (input: HTMLInputElement) => {
        setSubmitRef(input);
    };
    useMakeNavigable(submitRef);

    const [shareLinkRef, setShareLinkRef] = useState<HTMLInputElement | null>(
        null
    );
    const handleShareLinkRef = (input: HTMLInputElement) => {
        setShareLinkRef(input);
    };
    useMakeNavigable(shareLinkRef);

    const [helpLinkRef, setHelpLinkRef] = useState<HTMLButtonElement | null>(
        null
    );
    const handleHelpLinkRef = (input: HTMLButtonElement) => {
        setHelpLinkRef(input);
    };
    useMakeNavigable(helpLinkRef);

    return (
        <div className="scanQrPage">
            <h2>
                {lf("Add game to")}
                <br />
                {lf("Kiosk {0}", kioskId)}
            </h2>
            <div className="scanInstructions">
                <div className="qrOption">
                    {!scannerVisible && (
                        <GenericButton
                            title={lf("Scan QR code")}
                            label={lf("Scan QR code")}
                            className="kioskButton"
                            onClick={renderQrScanner}
                        />
                    )}
                    <div id="qrReader" ref={qrReaderRendered}></div>
                    {scannerVisible && (
                        <div className="scanning">
                            <GenericButton
                                title={lf("Cancel Scan")}
                                label={lf("Cancel Scan")}
                                className="scanQrButton"
                                onClick={stopQrScanner}
                            />
                            <p className="scanTip">
                                {lf("Tip: Do not use the kiosk's QR code")}
                            </p>
                        </div>
                    )}
                    <p>OR</p>
                </div>
                <div className="linkOption">
                    <label>{lf("Submit share link")}</label>
                    <input
                        type="url"
                        id="kiosk-share-link"
                        placeholder="Enter share link"
                        spellCheck={false}
                        required
                        title="Share Link"
                        tabIndex={0}
                        onChange={clearStatus}
                        ref={handleShareLinkRef}
                    />
                    <input
                        type="submit"
                        tabIndex={0}
                        onClick={checkUrl}
                        ref={handleSubmitRef}
                    />
                    {linkError && (
                        <p className="linkError">
                            {lf("Incorrect format for a share link")}
                        </p>
                    )}
                </div>
                <div className="shareHelp">
                    <GenericButton
                        title={lf("How do I get a game's share link or QR code?")}
                        label={lf("How do I get a game's share link or QR code?")}
                        target="_blank"
                        onClick={clickHelp}
                        href="https://arcade.makecode.com/share"
                        buttonRef={handleHelpLinkRef}
                    />
                </div>
            </div>
            {!!addingError && (
                <ErrorModal
                    errorType={addingError}
                    errorDescription={errorDesc!}
                    setShowing={setAddingError}
                />
            )}
        </div>
    );
};

export default ScanQR;
