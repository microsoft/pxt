import { stateAndDispatch, getBuiltGame } from "../State";
import { BuiltSimJSInfo, KioskState } from "../Types";
import * as Actions from "../State/Actions";
import * as Constants from "../Constants";
import { gamepadManager } from "./GamepadManager";
import { gameOver } from "../Transforms/gameOver";
import configData from "../config.json";
import { resetHighScores } from "../Transforms/resetHighScores";
import { escapeGame } from "../Transforms/escapeGame";
import { showMainMenu } from "../Transforms/showMainMenu";

function gamePadLoop() {
    const { state: kiosk } = stateAndDispatch();

    const isDebug = true;
    if (isDebug) {
        // Add cases for debugging via the gamepad here.
    }

    if (
        gamepadManager.isResetButtonPressed() &&
        gamepadManager.isEscapeButtonPressed() &&
        gamepadManager.isBButtonPressed() &&
        gamepadManager.isLeftPressed()
    ) {
        resetHighScores();
        console.log("High scores reset");
        return;
    }

    if (
        gamepadManager.isEscapeButtonPressed() ||
        gamepadManager.isMenuButtonPressed()
    ) {
        if (kiosk.kioskState === KioskState.PlayingGame) {
            escapeGame();
        } else {
            showMainMenu();
        }
        return;
    }
}

export function initialize() {
    setInterval(() => gamePadLoop(), configData.GamepadPollLoopMilli);

    function sendBuiltGame(gameId: string) {
        const { state } = stateAndDispatch();
        const builtGame = state.builtGamesCache[gameId];
        if (builtGame) {
            const simIframe = document.getElementsByTagName(
                "iframe"
            )[0] as HTMLIFrameElement;
            simIframe?.contentWindow?.postMessage(
                { ...builtGame, type: "builtjs" },
                "*"
            );
        }
    }

    window.addEventListener("message", event => {
        const { state, dispatch } = stateAndDispatch();
        if (event.data?.js && state.launchedGameId) {
            const builtGame: BuiltSimJSInfo =
                state.builtGamesCache?.[state.launchedGameId];
            if (!builtGame) {
                dispatch(
                    Actions.addBuiltGame(state.launchedGameId, event.data)
                );
            } else {
                sendBuiltGame(state.launchedGameId);
            }
        }
        switch (event.data.type) {
            case "simulator":
                switch (event.data.command) {
                    case "setstate":
                        switch (event.data.stateKey) {
                            case Constants.allScoresStateKey:
                                const rawData = atob(event.data.stateValue);
                                const json = decodeURIComponent(rawData);
                                dispatch(
                                    Actions.setMostRecentScores(
                                        JSON.parse(json)
                                    )
                                );
                                gameOver();
                                break;
                        }
                        break;
                }
                break;
            case "messagepacket":
                const channel = event.data.channel;
                const parts = channel.split("-");
                if (parts[0] === "keydown") {
                    gamepadManager.keyboardManager.onKeydown(parts[1]);
                } else {
                    gamepadManager.keyboardManager.onKeyup(parts[1]);
                }
                break;

            case "ready":
                const builtGame = getBuiltGame(state.launchedGameId);
                if (builtGame) {
                    sendBuiltGame(state.launchedGameId!);
                }
                break;
        }
    });
}
