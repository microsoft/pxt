import { getCollabCanvas } from "../../services/collabCanvas";
import { collabStateAndDispatch } from "../../state/collab";
import * as CollabActions from "../../state/collab/actions";

export function recvSetSessionValue(key: string, value: string) {
    const { dispatch } = collabStateAndDispatch();
    dispatch(CollabActions.setSessionValue(key, value));
    if (key.startsWith("s:")) {
        const sprite = JSON.parse(value);
        //getCollabCanvas().addPaintSprite(s);
    }
}
