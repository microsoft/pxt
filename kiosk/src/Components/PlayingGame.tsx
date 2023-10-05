import { useContext, useMemo } from "react";
import { AppStateContext } from "../State/AppStateContext";
import { escapeGame } from "../Transforms/escapeGame";
import { playSoundEffect } from "../Services/SoundEffectService";
import { useOnControlPress } from "../Hooks";
import * as GamepadManager from "../Services/GamepadManager";
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
        GamepadManager.GamepadControl.MenuButton
    );

    const playUrl = useMemo(() => {
        if (gameId) {
            const playUrlBase = `${configData.PlayUrlRoot}?id=${gameId}&hideSimButtons=1&noFooter=1&single=1&fullscreen=1&autofocus=1`;
            const playQueryParam = kiosk.builtGamesCache[gameId]
                ? "&server=1"
                : "&sendBuilt=1";
            return playUrlBase + playQueryParam;
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
