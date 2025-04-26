import { stateAndDispatch } from "@/state";
import { getPresence } from "@/state/helpers";
import { showToast } from "@/state/actions";
import { Strings } from "@/constants";
import { getUserValue } from "@/types";
import { makeToast } from "@/components/Toaster";

export async function playerJoinedAsync(clientId: string) {
    const { state, dispatch } = stateAndDispatch();
    try {
        const presence = getPresence();
        const user = presence?.users.find(u => u.id === clientId);
        if (user) {
            const name = getUserValue(user, "name", Strings.MissingName)!;
            dispatch(
                showToast(
                    makeToast({
                        type: "info",
                        text: Strings.PlayerJoinedFmt(name),
                        timeoutMs: 5000,
                    })
                )
            );
            /*
            simDriver()?.postMessage({
                type: "arcade-plato",
                content: "Connection",
                slot: user.slot,
                connected: true,
            } as SimMultiplayer.MultiplayerConnectionMessage);
             */
        }
    } catch {
    } finally {
    }
}
