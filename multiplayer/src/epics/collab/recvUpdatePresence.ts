import { collabStateAndDispatch } from "../../state/collab";
import * as CollabActions from "../../state/collab/actions";
import { Presence } from "../../types";

export function recvUpdatePresence(presence: Presence) {
    const { dispatch } = collabStateAndDispatch();
    dispatch(CollabActions.updatePresence(presence));
}
