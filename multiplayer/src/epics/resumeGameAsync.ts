import { state, dispatch } from "../state";
import * as gameClient from "../services/gameClient";
import { clearModal } from "../state/actions";

export async function resumeGameAsync() {
    const { clientRole } = state;

    try {
        pxt.tickEvent("mp.resumegame", { role: clientRole! });
        if (clientRole === "host") {
            await gameClient.resumeGameAsync();
            // TODO: resume simulator
        }
        dispatch(clearModal());
    } catch (e) {
    } finally {
    }
}
