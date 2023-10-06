import { Html5Qrcode } from "html5-qrcode";
import { canthrow_addGameToKioskAsync } from "../Services/BackendRequests";
import { KioskState } from "../Types";
import { navigate } from "../Transforms/navigate";

export const play = async (
    kioskId: string,
    html5QrCode: Html5Qrcode,
    setAddError: (p: string) => void,
    setDesc: (p: string) => void
) => {
    let devices: any[];

    async function onScanSuccess(decodedText: string, decodedResult: any) {
        const shareId = /\/([^\/]+)\/?$/.exec(decodedText)?.[1];
        try {
            await canthrow_addGameToKioskAsync(kioskId, shareId);
            pxt.tickEvent("kiosk.gameQrScanned.success");
            await html5QrCode.stop();
            navigate(KioskState.QrSuccess);
        } catch (error: any) {
            setAddError(error.toString());
            if (error.toString().includes("404")) {
                setDesc(
                    lf("This is likely because the kiosk code is expired. Go back to the kiosk to make a new code.")
                );
            } else {
                setDesc(lf("Something went wrong. Please try again later."));
            }
        }
    }

    function onScanFailure(errorMessage: string, error: any) {
        setDesc(lf("Failed to scan QR code. Please try again."));
    }

    try {
        devices = await Html5Qrcode.getCameras();
        if (devices && devices.length) {
            try {
                html5QrCode.start(
                    { facingMode: "environment" },
                    undefined,
                    onScanSuccess,
                    onScanFailure
                );
            } catch (error) {
                console.log("failed to start scanning");
            }
        }
    } catch (error) {
        console.log("couldn't get camera permissions");
    }
};

export const stopScan = async (html5QrCode: Html5Qrcode) => {
    await html5QrCode.stop();
};
