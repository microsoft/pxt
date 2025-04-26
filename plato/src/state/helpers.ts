import { AppStateContextProps, stateAndDispatch } from "./Context";
import { ClientRole, Presence } from "@/types";

export function getPresence(context?: AppStateContextProps): Presence | undefined {
    const { state } = stateAndDispatch(context);
    const { viewState } = state;
    if (!viewState) {
        return undefined;
    }
    const { presence } = viewState;
    return presence;
}

export function getClientRole(context?: AppStateContextProps): ClientRole {
    const { state } = stateAndDispatch(context);
    const { viewState } = state;
    if (!viewState) {
        return "none";
    }
    const { type } = viewState;
    return type;
}
