import { useEffect } from "react";

const QrSuccess: React.FC<{}> = () => {
    // TODO: pass the game's title and the kiosk's id through to give more feedback to the user
    useEffect(() => {
        pxt.tickEvent("kiosk.qrSuccessLoaded");
    }, []);

    return (
        <div className="qrSuccess">
            <p>{lf("You have successfully uploaded your game to the kiosk!")}</p>
            <p>{lf("You can close this window. Happy playing!")}</p>
        </div>
    );
};
export default QrSuccess;
