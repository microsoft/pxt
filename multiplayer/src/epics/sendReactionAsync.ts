import * as gameClient from "../services/gameClient";
import { Reactions } from "../types/reactions";

const TIMEOUT_PER_REACTION = 250;
const lastSentTime: number[] = [];
export async function sendReactionAsync(index: number) {
    try {
        if (!lastSentTime[index] || lastSentTime[index] + TIMEOUT_PER_REACTION < Date.now()) {
            lastSentTime[index] = Date.now();
            const reaction = Reactions[index];
            pxt.tickEvent("mp.sendreaction", { reaction: reaction.name });
            await gameClient.sendReactionAsync(index);
        }
    } catch (e) {
    } finally {
    }
}
