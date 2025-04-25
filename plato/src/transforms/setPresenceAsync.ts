import { stateAndDispatch } from "@/state";
import { Presence } from "@/types";
import { setPresence } from "@/state/actions";

export async function setPresenceAsync(presence: Presence) {
    const { dispatch } = stateAndDispatch();
    try {
        dispatch(setPresence(presence));
    } catch {
    } finally {
    }
}
