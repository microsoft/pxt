import { GameMode } from "../types";
import { dispatch } from "../state";
import { setGameMode, setPlayerSlot, showToast } from "../state/actions";

export async function setGameModeAsync(gameMode: GameMode, slot?: number) {
    try {
        dispatch(setGameMode(gameMode));
        if (gameMode === "playing") {
            dispatch(
                showToast({
                    type: "info",
                    text: lf("Game started!"),
                    timeoutMs: 5000,
                })
            );
        }
        if (slot) {
            dispatch(setPlayerSlot(slot));
        }
    } catch (e) {
    } finally {
    }
}
