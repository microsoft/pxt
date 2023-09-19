import { stateAndDispatch } from "../State";
import * as Actions from "../State/Actions";

export function selectGame(gameId: string) {
    const { state, dispatch } = stateAndDispatch();
    if (gameId) {
        dispatch(Actions.setSelectedGameId(gameId));
    }
}
