import { useEffect } from "react";
import { tickEvent } from "../browserUtils";
import "../Kiosk.css";

const QrSuccess: React.FC<{}> = () => {
    // TODO: pass the game's title and the kiosk's id through to give more feedback to the user
    useEffect(() => {
        tickEvent("kiosk.qrSuccessLoaded");
    },[]);

    return (
        <div className="qrSuccess">
            <p>You have successfully uploaded your game to the kiosk!</p>
            <p>You can close this window. Happy playing!</p>
        </div>
    )
}
export default QrSuccess;