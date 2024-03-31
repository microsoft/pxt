import { getCollabCanvas } from "../../services/collabCanvas";
import { collabStateAndDispatch } from "../../state/collab";
import * as CollabActions from "../../state/collab/actions";

export function recvPlayerLeft(playerId: string) {
    const { dispatch } = collabStateAndDispatch();
    dispatch(CollabActions.playerLeft(playerId));
    getCollabCanvas().removePlayerSprite(playerId);
}
