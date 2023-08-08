import { useEffect, useRef, useState } from "react";
import { Kiosk } from "../Models/Kiosk";
import "../Kiosk.css";
import { play, stopScan } from "./QrScanner";
import { addGameToKioskAsync } from "../BackendRequests";
import { KioskState } from "../Models/KioskState";
import { Html5Qrcode } from "html5-qrcode";
import { tickEvent } from "../browserUtils";
import ErrorModal from "./ErrorModal";

interface IProps {
    kiosk: Kiosk
}

const ScanQR: React.FC<IProps> = ({ kiosk }) => {
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
        tickEvent("kiosk.scanQrClicked");
        play(kiosk, kioskId!, html5QrCode!, setAddingError, setErrorDesc);
        setScannerVisible(true);
    }

    const stopQrScanner = () => {
        tickEvent("kiosk.stopScanClicked");
        stopScan(html5QrCode!);
        setScannerVisible(false);
    }

    const initiateQrCode = () => {
        if (qrReaderRendered.current) {
            const qrCodeReader = new Html5Qrcode("qrReader");
            setHtml5QrCode(qrCodeReader);
        }
    }

    const clickHelp = () => {
        tickEvent("kiosk.helpLink");
        return true;
    }

    useEffect(() => {
        tickEvent("kiosk.scanQrLoaded");
        initiateQrCode();
    }, [])

    const checkUrl = async () => {
        const input = document.getElementById("kiosk-share-link") as HTMLInputElement;
        const inputValue = input.value?.trim();
        const shareLink = /^(https:\/\/)((arcade\.makecode\.com\/)|(makecode\.com\/))((?:S?\d{5}-\d{5}-\d{5}-\d{5})$|(?:_[a-zA-Z0-9]+)$)/i.exec(inputValue);
        const shareCode = /(^(?:S?\d{5}-\d{5}-\d{5}-\d{5})$|^(?:_[a-zA-Z0-9]{12})$)/.exec(inputValue);
        let shareId;
        if (shareLink) {
            shareId = /\/([^\/]+)\/?$/.exec(inputValue)?.[1];
        } else if (shareCode) {
            shareId = shareCode[1];
        }
        tickEvent("kiosk.submitGameId.clicked", { submitVal: inputValue });
        if (shareId) {
            setLinkError(false);
            try {
                await addGameToKioskAsync(kioskId, shareId);
                tickEvent("kiosk.submitGameId.submitSuccess");
                kiosk.navigate(KioskState.QrSuccess);
            } catch (error: any) {
                setAddingError(error.toString());
                if (error.toString().includes("404")) {
                    setErrorDesc("The kiosk code expired. Go back to the kiosk to make a new code.");
                } else {
                    setErrorDesc("Something went wrong. Please try again later.");
                }
            }
        } else {
            setLinkError(true);
        }

    }

    const clearStatus = () => {
        if (linkError) {
            setLinkError(false);
        }
    }

    return (
        <div className="scanQrPage">
            <h2>Add game to<br/>Kiosk {kioskId}</h2>
            <div className="scanInstructions">
                <div className="qrOption">
                    {
                        !scannerVisible &&
                        <button className="scanQrButton" onClick={renderQrScanner} >Scan QR code</button>
                    }
                    <div id="qrReader" ref={qrReaderRendered}></div>
                    {
                        scannerVisible &&
                        <div className="scanning">
                            <button className="scanQrButton" onClick={stopQrScanner} >Cancel Scan</button>
                            <p className="scanTip">Tip: Do not use the kiosk's QR code</p>
                        </div>
                    }
                    <p>OR</p>
                </div>
                <div className="linkOption">
                    <label>Submit share link</label>
                    <input type="url"
                        id="kiosk-share-link"
                        placeholder="Enter share link"
                        spellCheck={false}
                        required
                        title="Share Link"
                        onChange={clearStatus}
                        />
                    <input type="submit" onClick={checkUrl} />
                    {
                        linkError &&
                        <p className="linkError">Incorrect format for a share link</p>
                    }
                </div>
                <a className="shareHelp" target="_blank" onClick={clickHelp} href="https://arcade.makecode.com/share">
                    How do I get a game's share link or QR code?
                </a>
            </div>
            {
                !!addingError &&
                <ErrorModal errorType={addingError} errorDescription={errorDesc!} setShowing={setAddingError}/>
            }
        </div>
    )
}

export default ScanQR;