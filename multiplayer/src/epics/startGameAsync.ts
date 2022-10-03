import * as gameClient from "../services/gameClient";

export async function startGameAsync() {
    try {
        await gameClient.startGameAsync();
    } catch (e) {
    } finally {
    }
}
