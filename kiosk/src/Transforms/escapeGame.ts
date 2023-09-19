import { stateAndDispatch } from "../State";
import { KioskState } from "../Types";
import { gamepadManager } from "../Services/GamepadManager";
import { exitGame } from "./exitGame";

export function escapeGame() {
    const { state: kiosk } = stateAndDispatch();

    if (kiosk.kioskState !== KioskState.PlayingGame || kiosk.lockedGameId) {
        return;
    }
    gamepadManager.keyboardManager.clear();
    exitGame(KioskState.MainMenu);
}
