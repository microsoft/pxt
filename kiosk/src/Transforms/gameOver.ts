import { stateAndDispatch } from "../State";
import { KioskState } from "../Types";
import { launchGame } from "./launchGame";
import { exitGame } from "./exitGame";
import { exitToEnterHighScore } from "./exitToEnterHighScore";

export function gameOver(skipHighScore?: boolean): void {
    const { state } = stateAndDispatch();
    if (state.kioskState !== KioskState.PlayingGame) {
        return;
    }

    if (state.lockedGameId) {
        launchGame(state.lockedGameId);
        return;
    }

    const selectedGame = state.allGames.find(
        g => g.id === state.selectedGameId
    );

    if (
        !skipHighScore &&
        selectedGame?.highScoreMode !== "None" &&
        state.mostRecentScores?.length
    ) {
        exitToEnterHighScore();
    } else {
        exitGame(KioskState.GameOver);
    }
}
