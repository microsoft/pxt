import { getCollabCanvas } from "../../services/collabCanvas";
import { collabStateAndDispatch, getCollabPlayers } from "../../state/collab";
import * as CollabActions from "../../state/collab/actions";
import { Presence } from "../../types";

export function recvUpdatePresence(presence: Presence) {
    const { dispatch } = collabStateAndDispatch();
    dispatch(CollabActions.updatePresence(presence));
    setTimeout(() => {
        const { state } = collabStateAndDispatch();
        getCollabPlayers(state).forEach(player => {
            let x = 0;
            let y = 0;
            let imgId = 0;
            if (player.kv.has("position")) {
                const pos = JSON.parse(player.kv.get("position")!);
                x = pos.x;
                y = pos.y;
            }
            if (player.kv.has("imgId")) {
                imgId = parseInt(player.kv.get("imgId")!);
            }
            getCollabCanvas().addPlayerSprite(player.clientId, x, y, imgId);
        });
    }, 1);
}
