import * as gameClient from "../services/gameClient";
import { dispatch } from "../state";
import { clearGameInfo, clearGameMetadata } from "../state/actions";

export async function leaveGameAsync() {
    try {
        await gameClient.leaveGameAsync();
        dispatch(clearGameInfo());
        dispatch(clearGameMetadata());
    } catch (e) {
    } finally {
    }
}
