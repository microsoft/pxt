import { stateAndDispatch } from "../State";
import { KioskState } from "../Types";
import * as Actions from "../State/Actions";
import configData from "../config.json";
import { navigate } from "./navigate";
import * as Gamespace from "../Services/Gamespace";

export function launchGame(
    gameId: string,
    preventReturningToMenu = false
): void {
    const { state, dispatch } = stateAndDispatch();

    dispatch(Actions.setLaunchedGame(gameId));

    if (state.kioskState === KioskState.PlayingGame) {
        return;
    }
    if (preventReturningToMenu) dispatch(Actions.setLockedGame(gameId));
    navigate(KioskState.PlayingGame);

    Gamespace.removeElements();

    const playUrlBase = `${configData.PlayUrlRoot}?id=${gameId}&hideSimButtons=1&noFooter=1&single=1&fullscreen=1&autofocus=1`;
    let playQueryParam = state.builtGamesCache[gameId]
        ? "&server=1"
        : "&sendBuilt=1";

    function createIFrame(src: string) {
        const iframe: HTMLIFrameElement = document.createElement("iframe");
        iframe.className = "sim-embed";
        iframe.frameBorder = "0";
        iframe.setAttribute(
            "sandbox",
            "allow-popups allow-forms allow-scripts allow-same-origin"
        );
        iframe.src = src;
        return iframe;
    }
    const playerIFrame = createIFrame(playUrlBase + playQueryParam);
    Gamespace.append(playerIFrame);
    playerIFrame.focus();
}
