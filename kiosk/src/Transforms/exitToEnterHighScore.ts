import { stateAndDispatch } from "../State";
import configData from "../config.json";
import { KioskState } from "../Types";
import { exitGame } from "./exitGame";

export function exitToEnterHighScore(highScoreMode: string): void {
    const { state } = stateAndDispatch();

    if (!state.mostRecentScores?.length) {
        console.error(
            "Cannot load high score entry view without recent scores"
        );
        exitGame(KioskState.GameOver);
        return;
    }

    let launchedGameHighs = state.launchedGameId
        ? state.allHighScores[state.launchedGameId]
        : [];
    launchedGameHighs = launchedGameHighs || [];
    const currentHighScore = state.mostRecentScores[0];
    const lastScore = launchedGameHighs[launchedGameHighs.length - 1]?.score;
    const scoreOutOfRange = highScoreMode === "lowscore" ? currentHighScore > lastScore : currentHighScore < lastScore;

    if (
        launchedGameHighs.length === configData.HighScoresToKeep &&
        lastScore &&
        scoreOutOfRange
    ) {
        exitGame(KioskState.GameOver);
    } else {
        exitGame(KioskState.EnterHighScore);
    }
}
