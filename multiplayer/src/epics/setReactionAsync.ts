import { state, dispatch } from "../state";
import { setReaction, clearReaction } from "../state/actions";
import { nanoid } from "nanoid";

export async function setReactionAsync(clientId: string, index: number) {
    try {
        const reactionId = nanoid();
        dispatch(setReaction(clientId, reactionId, index));
        setTimeout(() => {
            if (state.reactions[clientId]?.id === reactionId) {
                dispatch(clearReaction(clientId));
            }
        }, 1000);
    } catch (e) {
    } finally {
    }
}
