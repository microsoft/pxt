import { AppStateContextProps, stateAndDispatch } from "./Context";
import { ClientRole } from "@/types";
import { NetState } from "./state";

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
