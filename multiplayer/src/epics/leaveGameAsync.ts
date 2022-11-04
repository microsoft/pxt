import * as gameClient from "../services/gameClient";
import { dispatch } from "../state";
import { clearGameInfo, clearGameMetadata } from "../state/actions";
import { GameOverReason } from "../types";

export async function leaveGameAsync(reason: GameOverReason) {
    try {
        pxt.tickEvent("mp.leavegame");
        await gameClient.leaveGameAsync(reason);
        dispatch(clearGameInfo());
        dispatch(clearGameMetadata());
    } catch (e) {
    } finally {
    }
}
