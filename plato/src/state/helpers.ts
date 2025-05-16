import { AppStateContextProps, stateAndDispatch } from "./Context";
import { ClientRole, ViewPlayer } from "@/types";
import { NetState } from "./state";
import * as collabClient from "@/services/collabClient";

export function getClientRole(context?: AppStateContextProps): ClientRole {
    const { state } = stateAndDispatch(context);
    const { netState } = state;
    if (!netState) {
        return "none";
    }
    const { clientRole } = netState;
    return clientRole ?? "none";
}

export function getNetState(forRole?: ClientRole, context?: AppStateContextProps): NetState | undefined {
    const { state } = stateAndDispatch(context);
    const { netState } = state;
    if (!netState) {
        return undefined;
    }
    if (forRole && netState.clientRole !== forRole) {
        return undefined;
    }
    return netState;
}

export function getDisplayName(player: ViewPlayer | string | undefined, defaultName: string): string {
    if (!player) {
        return defaultName;
    }
    if (typeof player === "string") {
        player = collabClient.playerPresenceStore.getSnapshot().find(p => p.id === player);
        if (!player) {
            return defaultName;
        }
    }
    const { realNames } = collabClient.sessionStore.getSnapshot();
    if (realNames) {
        return player.realName || defaultName;
    }
    return player.name || defaultName;
}

export function getIsHost(context?: AppStateContextProps): boolean {
    const { state } = stateAndDispatch(context);
    const { netState } = state;
    if (!netState) {
        return false;
    }
    return netState.clientRole === "host";
}
