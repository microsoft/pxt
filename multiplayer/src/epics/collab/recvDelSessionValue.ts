import { getCollabCanvas } from "../../services/collabCanvas";
import { collabStateAndDispatch } from "../../state/collab";
import * as CollabActions from "../../state/collab/actions";
import * as collabClient from "../../services/collabClient";

export function recvDelSessionValue(key: string, senderId: string) {
    if (senderId === collabClient.getClientId()) return;
    const { dispatch } = collabStateAndDispatch();
    dispatch(CollabActions.delSessionValue(key));
    if (key.startsWith("s:")) {
        getCollabCanvas().removePaintSprite(key);
    }
}
