import { stateAndDispatch } from "../State";
import { KioskState } from "../Types";
import { navigate } from "./navigate";

export function exitGame(nextState: KioskState): void {
    const { state } = stateAndDispatch();

    if (state.kioskState !== KioskState.PlayingGame) {
        return;
    }

    navigate(nextState);
}
