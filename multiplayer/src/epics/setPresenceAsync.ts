import { dispatch } from "../state"
import { Presence } from "../types"
import { setPresence } from "../state/actions"

export async function setPresenceAsync(presence: Presence) {
    try {
        dispatch(setPresence(presence))
    } catch (e) {
    } finally {
    }
}
