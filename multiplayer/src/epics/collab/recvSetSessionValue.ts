import { getCollabCanvas } from "../../services/collabCanvas";
import { collabStateAndDispatch } from "../../state/collab";
import * as CollabActions from "../../state/collab/actions";
import * as collabClient from "../../services/collabClient";

export function recvSetSessionValue(key: string, value: string, senderId: string) {
    if (senderId === collabClient.getClientId()) return;
    const { dispatch } = collabStateAndDispatch();
    dispatch(CollabActions.setSessionValue(key, value));
    if (key.startsWith("s:")) {
        const sprite = JSON.parse(value);
        getCollabCanvas().addPaintSprite(key, sprite.x, sprite.y, sprite.s, sprite.c, sprite.a);
    }
}
