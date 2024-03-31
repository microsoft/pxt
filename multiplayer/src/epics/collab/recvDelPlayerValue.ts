import { getCollabCanvas } from "../../services/collabCanvas";
import { collabStateAndDispatch } from "../../state/collab";
import * as CollabActions from "../../state/collab/actions";

export function recvDelPlayerValue(playerId: string | undefined, key: string) {
    if (!playerId) return;
    const { dispatch } = collabStateAndDispatch();
    dispatch(CollabActions.delPlayerValue(playerId, key));
}
