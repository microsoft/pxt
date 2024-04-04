import { getCollabCanvas } from "../../services/collabCanvas";
import { Presence } from "../../types";

export function recvPresence(presence: Presence) {
    presence.users.forEach((user) => {
        getCollabCanvas().addPlayerSprite(user.id, 0, 0, 0);
    });
}
