import { getCollabCanvas } from "../../services/collabCanvas";
import { collabStateAndDispatch } from "../../state/collab";
import * as CollabActions from "../../state/collab/actions";
import * as collabClient from "../../services/collabClient";

export function recvSetPlayerValue(key: string, value: string, senderId: string) {
    if (senderId === collabClient.getClientId()) return;
    const { dispatch } = collabStateAndDispatch();
    dispatch(CollabActions.setPlayerValue(senderId, key, value));
    if (key === "position") {
        const pos = JSON.parse(value);
        getCollabCanvas().updatePlayerSpritePosition(senderId, pos.x, pos.y);
    } else if (key === "imgId") {
        getCollabCanvas().updatePlayerSpriteImage(senderId, parseInt(JSON.parse(value)));
    }
}
