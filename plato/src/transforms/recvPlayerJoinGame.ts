import { Strings } from "@/constants";
import * as collabClient from "@/services/collabClient";
import * as simHost from "@/services/simHost";
import { getDisplayName } from "@/state/helpers";

export function recvPlayerJoinGame(clientId: string, currentGame: string) {
    // Get the ViewPlayer record for the playerId
    const player = collabClient.playerPresenceStore.getSnapshot().find(p => p.id === clientId);
    const session = collabClient.sessionStore.getSnapshot();
    if (!player || !session) return;
    const { id: playerId } = player;
    const playerName = getDisplayName(player, Strings.MissingName);
    simHost.playerJoin(playerId, playerName);
}
