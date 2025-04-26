import { stateAndDispatch } from "@/state";
import { getPresence } from "@/state/helpers";
import { showToast } from "@/state/actions";
import { simDriver } from "@/services/simHost";
import { makeToast } from "@/components/Toaster";
import { getUserValue } from "@/types";
import { Strings } from "@/constants";

export async function playerLeftAsync(clientId: string) {
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
                        text: Strings.PlayerLeftFmt(name),
                        timeoutMs: 5000,
                    })
                )
            );
            /*
            simDriver()?.postMessage({
                type: "arcade-plato",
                content: "Connection",
                slot: user.slot,
                connected: false,
            } as SimMultiplayer.MultiplayerConnectionMessage);
             */
        }
    } catch {
    } finally {
    }
}
