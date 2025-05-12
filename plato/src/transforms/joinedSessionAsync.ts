import * as collabClient from "@/services/collabClient";
import { generateRandomName } from "@/utils";
import { setNetState } from "@/state/actions";
import { stateAndDispatch } from "@/state";
import { ClientRole } from "@/types";

export async function joinedSessionAsync(clientRole: ClientRole, clientId: string) {
    collabClient.setClientValue(clientId, "name", generateRandomName());
    const { state, dispatch } = stateAndDispatch();
    const { netState } = state;
    dispatch(setNetState({
        ...netState,
        clientId,
        clientRole,
    }));
}
