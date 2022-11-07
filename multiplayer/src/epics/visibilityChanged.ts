import { state } from "../state";
import { pauseGameAsync } from ".";

export async function visibilityChanged(visible: boolean) {
    const { clientRole, gameState } = state;
    const { gameMode } = gameState ?? {};
    try {
        if (!visible && clientRole === "host" && gameMode === "playing") {
            await pauseGameAsync();
        }
    } catch (e) {
    } finally {
    }
}
