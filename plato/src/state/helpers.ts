import { AppStateContextProps, stateAndDispatch } from "./Context";
import { ClientRole, Presence } from "@/types";

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
