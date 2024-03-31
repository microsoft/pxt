import { getCollabCanvas } from "../../services/collabCanvas";
import { collabStateAndDispatch } from "../../state/collab";
import * as CollabActions from "../../state/collab/actions";

export function recvPlayerJoined(playerId: string, kv?: Map<string, string>) {
    const { dispatch } = collabStateAndDispatch();
    dispatch(CollabActions.playerJoined(playerId, kv));
    getCollabCanvas().addPlayerSprite(playerId, 0, 0, 0);
}
