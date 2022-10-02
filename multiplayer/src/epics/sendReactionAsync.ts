import * as gameClient from "../services/gameClient"

export async function sendReactionAsync(index: number) {
    try {
        // TODO: Debounce this, per index, spam the server with messages
        await gameClient.sendReactionAsync(index)
    } catch (e) {
    } finally {
    }
}
