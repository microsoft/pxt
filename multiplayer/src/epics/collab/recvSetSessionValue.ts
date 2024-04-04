import { getCollabCanvas } from "../../services/collabCanvas";
import * as collabClient from "../../services/collabClient";

export function recvSetSessionValue(key: string, value: string, senderId: string) {
    if (senderId === collabClient.getClientId()) return;
    if (key.startsWith("s:")) {
        const sprite = JSON.parse(value);
        getCollabCanvas().addPaintSprite(key, sprite.x, sprite.y, sprite.s, sprite.c, sprite.a);
    }
}
