import { getCollabCanvas } from "../../services/collabCanvas";

export function recvPlayerLeft(playerId: string) {
    getCollabCanvas().removePlayerSprite(playerId);
}
