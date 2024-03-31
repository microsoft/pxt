import { GameMode } from "../types";
import { dispatch, state } from "../state";
import { clearModal, setGameMode, setPlayerSlot, showToast } from "../state/actions";
import { pauseGameAsync } from ".";

export async function setGameModeAsync(gameMode: GameMode, gamePaused: boolean, slot?: number) {
    const { clientRole } = state;

    try {
        if (slot) {
            dispatch(setPlayerSlot(slot));
        }
        dispatch(setGameMode(gameMode));
        if (gameMode === "playing") {
            dispatch(clearModal());
            dispatch(
                showToast({
                    type: "info",
                    text: lf("Game started!"),
                    timeoutMs: 5000,
                })
            );
            if (gamePaused && clientRole !== "host") {
                // If the game was paused when we joined, pause the game locally
                pauseGameAsync();
            }
        }
    } catch (e) {
    } finally {
    }
}
