import * as gameClient from "../services/gameClient";
import { Reactions } from "../types/reactions";

export async function sendReactionAsync(index: number) {
    try {
        // TODO: Debounce this, per index, to avoid spamming the server with messages
        const reaction = Reactions[index];
        pxt.tickEvent("mp.sendreaction", { reaction: reaction.name });
        await gameClient.sendReactionAsync(index);
    } catch (e) {
    } finally {
    }
}
