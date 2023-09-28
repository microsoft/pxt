import { stateAndDispatch } from "../State";
import * as Actions from "../State/Actions";
import { makeHighScore } from "../Utils";

export function saveHighScore(gameId: string, initials: string, score: number) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.saveHighScore(gameId, makeHighScore(initials, score)));
}
