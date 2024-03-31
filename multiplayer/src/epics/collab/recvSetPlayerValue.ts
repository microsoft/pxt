import { getCollabCanvas } from "../../services/collabCanvas";
import { collabStateAndDispatch } from "../../state/collab";
import * as CollabActions from "../../state/collab/actions";

export function recvSetPlayerValue(playerId: string | undefined, key: string, value: string) {
    if (!playerId) return;
    const { dispatch } = collabStateAndDispatch();
    dispatch(CollabActions.setPlayerValue(playerId, key, value));
    if (key === "position") {
        const pos = JSON.parse(value);
        getCollabCanvas().updatePlayerSpritePosition(playerId, pos.x, pos.y);
    } else if (key === "imgId") {
        getCollabCanvas().updatePlayerSpriteImage(playerId, parseInt(JSON.parse(value)));
    }
}
