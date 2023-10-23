import { useContext, useMemo } from "react";
import { AppStateContext } from "../State/AppStateContext";
import { escapeGame } from "../Transforms/escapeGame";
import { playSoundEffect } from "../Services/SoundEffectService";
import { useOnControlPress } from "../Hooks";
import { stringifyQueryString } from "../Utils";
import * as GamepadManager from "../Services/GamepadManager";
import * as Storage from "../Services/LocalStorage";
import configData from "../config.json";

export default function PlayingGame() {
    const { state: kiosk, dispatch } = useContext(AppStateContext);
    const { launchedGameId: gameId } = kiosk;

    // Handle Escape and Menu button presses
    useOnControlPress(
        [],
        () => {
            playSoundEffect("select");
            escapeGame();
        },
        GamepadManager.GamepadControl.EscapeButton,
        GamepadManager.GamepadControl.ResetButton
    );

    const playUrl = useMemo(() => {
        if (gameId) {
            const builtGame = Storage.getBuiltJsInfo(gameId);
            return stringifyQueryString(configData.PlayUrlRoot, {
                id: gameId,
                // TODO: Show sim buttons on mobile & touch devices.
                hideSimButtons: 1,
                noFooter: 1,
                single: 1,
                fullscreen: 1,
                autofocus: 1,
                loadingColor: "white",
                // If we have the built game cached, we will send it to the
                // simulator once it loads. The `server` flag inhibits the
                // simulator from trying to build it.
                server: builtGame ? 1 : undefined,
                // If we don't have the built game cached, tell the simulator to
                // send it to us once it's built and we'll cache it.
                sendBuilt: builtGame ? undefined : 1,
            });
        }
    }, [gameId]);

    return (
        <iframe
            className="sim-embed"
            sandbox="allow-popups allow-forms allow-scripts allow-same-origin"
            src={playUrl}
        ></iframe>
    );
}
