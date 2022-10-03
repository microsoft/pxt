import { state, dispatch } from "../state";
import { setReaction, clearReaction } from "../state/actions";
import { nanoid } from "nanoid";

export async function setReactionAsync(userId: string, index: number) {
    try {
        const reactionId = nanoid();
        dispatch(setReaction(userId, reactionId, index));
        setTimeout(() => {
            if (state.reactions[userId]?.id === reactionId) {
                dispatch(clearReaction(userId));
            }
        }, 1000);
    } catch (e) {
    } finally {
    }
}
