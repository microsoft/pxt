import { GameMode } from "../types";
import { dispatch, state } from "../state";
import {
    clearModal,
    setGameMode,
    setPlayerSlot,
    showModal,
    showToast,
} from "../state/actions";

export async function setGameModeAsync(gameMode: GameMode, slot?: number) {
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
        }
    } catch (e) {
    } finally {
    }
}
