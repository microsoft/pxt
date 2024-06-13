import { getCollabCanvas } from "../../services/collabCanvas";

export function connected(clientId: string) {
    getCollabCanvas().addPlayerSprite(clientId, 0, 0, 0);
}
