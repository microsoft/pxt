import { GameMode } from "../types";
import { dispatch } from "../state";
import { setGameMode, showToast } from "../state/actions";

export async function setGameModeAsync(gameMode: GameMode) {
    try {
        dispatch(setGameMode(gameMode));
        if (gameMode === "playing")
            dispatch(
                showToast({
                    type: "info",
                    text: lf("Game started!"),
                    timeoutMs: 5000,
                })
            );
    } catch (e) {
    } finally {
    }
}
