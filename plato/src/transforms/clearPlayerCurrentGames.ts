import * as collabClient from "@/services/collabClient";
import { setPlayerValue } from "./setPlayerValue";

export function clearPlayerCurrentGames() {
    const players = collabClient.playerPresenceStore.getSnapshot();
    for (const player of players) {
        setPlayerValue(player.id, "currentGame", undefined);
    }
}
