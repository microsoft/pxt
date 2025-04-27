import { AppStateContextProps, stateAndDispatch } from "./Context";
import { ClientRole, Presence } from "@/types";
import { GuestNetState, HostNetState } from "./state";

export function getPresence(context?: AppStateContextProps): Presence | undefined {
    const { state } = stateAndDispatch(context);
    const { netState } = state;
    if (!netState) {
        return undefined;
    }
    const { presence } = netState;
    return presence;
}

export function getClientRole(context?: AppStateContextProps): ClientRole {
    const { state } = stateAndDispatch(context);
    const { netState } = state;
    if (!netState) {
        return "none";
    }
    const { type } = netState;
    return type ?? "none";
}

export function getHostNetState(context?: AppStateContextProps): HostNetState | undefined {
    const { state } = stateAndDispatch(context);
    const { netState } = state;
    if (!netState) {
        return undefined;
    }
    if (netState.type !== "host") {
        return undefined;
    }
    return netState as HostNetState;
}

export function getGuestNetState(context?: AppStateContextProps): GuestNetState | undefined {
    const { state } = stateAndDispatch(context);
    const { netState } = state;
    if (!netState) {
        return undefined;
    }
    if (netState.type !== "guest") {
        return undefined;
    }
    return netState as GuestNetState;
}
