import { stateAndDispatch } from "../State";
import { KioskState } from "../Types";
import { launchGame } from "./launchGame";
import { exitGame } from "./exitGame";
import { exitToEnterHighScore } from "./exitToEnterHighScore";

export function gameOver(skipHighScore?: boolean): void {
    // This is a hack to make sure all reducer actions have finished before referencing state. Otherwise, the state object may be out of date.
    // In this instance, `mostRecentScores` may not be populated yet, so we need to wait until the next frame to check it.
    setTimeout(() => {
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
    }, 1);
}
