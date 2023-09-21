import { stateAndDispatch } from "../State";
import { KioskState } from "../Types";
import * as Actions from "../State/Actions";
import { navigate } from "./navigate";

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
}
