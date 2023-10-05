import { stateAndDispatch } from "../State";
import { KioskState } from "../Types";
import { exitGame } from "./exitGame";

export function escapeGame() {
    const { state: kiosk } = stateAndDispatch();

    if (kiosk.kioskState !== KioskState.PlayingGame || kiosk.lockedGameId) {
        return;
    }

    exitGame(KioskState.MainMenu);
}
