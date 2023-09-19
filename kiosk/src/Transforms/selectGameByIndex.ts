import { stateAndDispatch } from "../State";
import * as Actions from "../State/Actions";

export function selectGameByIndex(gameIndex: number): void {
    const { state, dispatch } = stateAndDispatch();
    if (gameIndex >= 0 && gameIndex < state.allGames.length) {
        const selectedGame = state.allGames[gameIndex];
        dispatch(Actions.setSelectedGameId(selectedGame.id));
    } else {
        dispatch(Actions.setSelectedGameId(undefined));
    }
}
