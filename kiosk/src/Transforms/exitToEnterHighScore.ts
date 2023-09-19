import { stateAndDispatch } from "../State";
import configData from "../config.json";
import { KioskState } from "../Types";
import { exitGame } from "./exitGame";

export function exitToEnterHighScore(): void {
    const { state } = stateAndDispatch();
    const launchedGameHighs = state.launchedGameId
        ? state.allHighScores[state.launchedGameId]
        : [] || [];
    const currentHighScore = state.mostRecentScores[0];
    const lastScore = launchedGameHighs[launchedGameHighs.length - 1]?.score;
    if (
        launchedGameHighs.length === configData.HighScoresToKeep &&
        lastScore &&
        currentHighScore < lastScore
    ) {
        exitGame(KioskState.GameOver);
    } else {
        exitGame(KioskState.EnterHighScore);
    }
}
