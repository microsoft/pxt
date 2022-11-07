import { GameOverReason } from "../types";
import * as gameClient from "../services/gameClient";

export async function gameOverAsync(reason: GameOverReason) {
    try {
        gameClient.gameOver(reason);
    } catch (e) {
    } finally {
    }
}
