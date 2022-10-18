import { GameMode } from "../types";
import { dispatch, state } from "../state";
import { clearModal, setGameMode, setPlayerSlot, showModal, showToast } from "../state/actions";

export async function setGameModeAsync(gameMode: GameMode, slot?: number) {
    try {
        dispatch(setGameMode(gameMode));
        if(gameMode === "lobby") {
            const lobbyMode = state.appMode.uiMode === "host" ? "host-lobby" : "join-lobby";
            dispatch(showModal(lobbyMode));
        }
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
        if (slot) {
            dispatch(setPlayerSlot(slot));
        }
    } catch (e) {
    } finally {
    }
}
