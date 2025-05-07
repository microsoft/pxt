import { AppStateContextProps, stateAndDispatch } from "./Context";
import { ClientRole } from "@/types";
import { GuestNetState, HostNetState } from "./state";

export function getClientRole(context?: AppStateContextProps): ClientRole {
    const { state } = stateAndDispatch(context);
    const { netState } = state;
    if (!netState) {
        return "none";
    }
    const { clientRole } = netState;
    return clientRole ?? "none";
}

export function getHostNetState(context?: AppStateContextProps): HostNetState | undefined {
    const { state } = stateAndDispatch(context);
    const { netState } = state;
    if (!netState) {
        return undefined;
    }
    if (netState.clientRole !== "host") {
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
    if (netState.clientRole !== "guest") {
        return undefined;
    }
    return netState as GuestNetState;
}
