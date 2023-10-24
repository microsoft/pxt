import { stateAndDispatch } from "../State";
import * as Actions from "../State/Actions";

export function resetHighScores() {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.resetHighScores());
}
