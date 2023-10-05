import { stateAndDispatch, getBuiltGame } from "../State";
import { BuiltSimJSInfo } from "../Types";
import * as Actions from "../State/Actions";
import * as Constants from "../Constants";
import { gameOver } from "../Transforms/gameOver";
import { resetHighScores } from "../Transforms/resetHighScores";
import * as GamepadManager from "./GamepadManager";
import { postNotification } from "../Transforms/postNotification";
import { makeNotification } from "../Utils";

export function initialize() {
    let controlStates: GamepadManager.ControlStates = {
        ...GamepadManager.emptyControlStates(),
    };

    const keydownhandler = (ev: KeyboardEvent) => {
        const control = GamepadManager.keyboardKeyToGamepadControl(ev.key);
        if (!control) {
            return;
        }
        controlStates[control] = GamepadManager.ControlValue.Down;

        // Look for the high scores reset combo
        if (
            controlStates[GamepadManager.GamepadControl.ResetButton] &&
            controlStates[GamepadManager.GamepadControl.EscapeButton] &&
            controlStates[GamepadManager.GamepadControl.BButton] &&
            controlStates[GamepadManager.GamepadControl.DPadLeft]
        ) {
            // Lock the combo so it doesn't get triggered repeatedly
            GamepadManager.lockControl(
                GamepadManager.GamepadControl.ResetButton
            );
            GamepadManager.lockControl(
                GamepadManager.GamepadControl.EscapeButton
            );
            GamepadManager.lockControl(GamepadManager.GamepadControl.BButton);
            GamepadManager.lockControl(GamepadManager.GamepadControl.DPadLeft);

            // Clear the control states so the combo doesn't get triggered again
            // until all buttons are released
            controlStates = {
                ...GamepadManager.emptyControlStates(),
            };

            // Reset the high scores
            pxt.tickEvent("kiosk.resetHighScores");
            resetHighScores();

            // Show a notification
            postNotification(makeNotification("High scores reset", 5000));
        }
    };

    const keyuphandler = (ev: KeyboardEvent) => {
        const control = GamepadManager.keyboardKeyToGamepadControl(ev.key);
        if (!control) {
            return;
        }
        controlStates[control] = GamepadManager.ControlValue.Up;
    };

    GamepadManager.addKeydownListener(keydownhandler);
    GamepadManager.addKeyupListener(keyuphandler);

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
                if (parts[0] === "keydown" || parts[0] === "keyup") {
                    // This allows us to listen for the Escape key when the
                    // simulator iframe is focused
                    GamepadManager.emitKeyEvent(parts[0], parts[1]);
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
