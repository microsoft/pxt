import { stateAndDispatch } from "../State";
import * as Actions from "../State/Actions";

export function removeGame(gameId: string) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.removeGame(gameId));
}
