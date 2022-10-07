import { useContext, useRef } from "react";
import { AppStateContext } from "../state/AppStateContext";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { gameId, playerSlot } = state;
    const simIframeRef = useRef<HTMLIFrameElement>(null);

    const playerThemes = [
        "background-color=ED3636&button-stroke=8d2525&button-fill=0b0b0b",
        "background-color=4E4EE9&button-stroke=3333a1&button-fill=0b0b0b",
        "background-color=FFDF1A&button-stroke=c1a916&button-fill=0b0b0b",
        "background-color=4EB94E&button-stroke=245d24&button-fill=0b0b0b",
    ];
    const selectedPlayerTheme = playerThemes[(playerSlot || 0) - 1];
    const isHost = playerSlot == 1;

    const queryParameters = [
        "single=1",
        "nofooter=1",
        "fullscreen=1",
        selectedPlayerTheme && `simParams=${encodeURIComponent(selectedPlayerTheme)}`,
    ].filter(el => !!el);

    if (isHost) {
        queryParameters.push(
            `id=${gameId || "69052-09321-39220-20264"}`,
            "mp=server"
        );
    } else {
        queryParameters.push(
            `code=${encodeURIComponent("multiplayer.init()")}`,
            "mp=client",
        );
    }

    const fullUrl = `${pxt.webConfig.runUrl}?${queryParameters.join("&")}`;
    return <div id="sim-container" className="grow mt-5">
        <iframe ref={simIframeRef}
            // todo jwunderl: handle height / width tailwind style
            style={{ height: "calc(100vh-26rem)", width: "100vw"}}
            src={fullUrl}
            allowFullScreen={true}
            className="w-full h-full"
            sandbox='allow-popups allow-forms allow-scripts allow-same-origin'
            title={lf("Arcade Game Simulator")}
        />
    </div>
}