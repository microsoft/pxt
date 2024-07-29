import * as collabClient from "../services/collabClient";
import { dispatch } from "../state";
import { clearGameInfo, clearGameMetadata } from "../state/actions";
import { SessionOverReason } from "../types";

export async function leaveCollabAsync(reason: SessionOverReason) {
    try {
        pxt.tickEvent("mp.leavecollab");
        await collabClient.leaveCollabAsync(reason);
        dispatch(clearGameInfo());
        dispatch(clearGameMetadata());
    } catch (e) {
    } finally {
    }
}
