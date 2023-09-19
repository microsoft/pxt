import { stateAndDispatch } from "../State";
import { KioskState } from "../Types";
import * as Actions from "../State/Actions";
import { navigate } from "./navigate";
import * as Gamespace from "../Services/Gamespace";

export function exitGame(nextState: KioskState): void {
    const { state } = stateAndDispatch();
    if (state.kioskState !== KioskState.PlayingGame) {
        return;
    }

    navigate(nextState);

    Gamespace.addElements();
}
