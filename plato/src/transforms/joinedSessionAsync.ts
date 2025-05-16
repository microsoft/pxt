import * as collabClient from "@/services/collabClient";
import { generateRandomName } from "@/utils";
import { setNetState } from "@/state/actions";
import { stateAndDispatch } from "@/state";
import { ClientRole } from "@/types";

export async function joinedSessionAsync(clientRole: ClientRole, clientId: string) {
    const { state, dispatch } = stateAndDispatch();
    const { netState } = state;
    collabClient.setClientValue(clientId, "name", generateRandomName());
    collabClient.setClientValue(clientId, "realName", state.userProfile?.idp?.displayName ?? "");
    dispatch(
        setNetState({
            ...netState,
            clientId,
            clientRole,
        })
    );
}
