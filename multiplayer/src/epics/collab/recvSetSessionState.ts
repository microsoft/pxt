import { getCollabCanvas } from "../../services/collabCanvas";
import { collabStateAndDispatch } from "../../state/collab";
import * as CollabActions from "../../state/collab/actions";

export function recvSetSessionState(sessKv: Map<string, string>) {
    const { dispatch } = collabStateAndDispatch();
    dispatch(CollabActions.setSessionState(sessKv));
    sessKv.forEach((value, key) => {
        if (key.startsWith("s:")) {
            const sprite = JSON.parse(value);
            getCollabCanvas().addPaintSprite(
                sprite.x,
                sprite.y,
                sprite.s,
                sprite.c
            );
        }
    });
}
