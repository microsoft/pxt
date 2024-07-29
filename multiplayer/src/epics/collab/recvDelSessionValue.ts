import { getCollabCanvas } from "../../services/collabCanvas";
import * as collabClient from "../../services/collabClient";

export function recvDelSessionValue(key: string, senderId: string) {
    if (senderId === collabClient.getClientId()) return;
    if (key.startsWith("s:")) {
        getCollabCanvas().removePaintSprite(key);
    }
}
