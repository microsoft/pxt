import * as collabClient from "@/services/collabClient";

export function recvSetPlayerValue(key: string, value: string, senderId: string) {
    if (senderId === collabClient.getClientId()) return;
    if (key === "position") {
        const pos = JSON.parse(value);
        //getCollabCanvas().updatePlayerSpritePosition(senderId, pos.x, pos.y);
    } else if (key === "imgId") {
        //getCollabCanvas().updatePlayerSpriteImage(senderId, parseInt(JSON.parse(value)));
    }
}
