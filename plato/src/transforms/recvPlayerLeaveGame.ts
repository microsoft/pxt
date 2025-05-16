import * as collabClient from "@/services/collabClient";
import * as simHost from "@/services/simHost";

export function recvPlayerLeaveGame(clientId: string) {
    // Get the ViewPlayer record for the playerId
    const player = collabClient.playerPresenceStore.getSnapshot().find(p => p.id === clientId);
    const session = collabClient.sessionStore.getSnapshot();
    if (!player || !session) return;
    const { id: playerId } = player;
    simHost.playerLeave(playerId);
}
