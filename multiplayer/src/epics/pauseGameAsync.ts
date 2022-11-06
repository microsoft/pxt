import { state, dispatch } from "../state";
import * as gameClient from "../services/gameClient";
import { showModal } from "../state/actions";

export async function pauseGameAsync() {
    const { clientRole } = state;

    try {
        pxt.tickEvent("mp.pausegame", { role: clientRole! });
        if (clientRole === "host") {
            await gameClient.pauseGameAsync();
            // TODO: pause simulator
        }
        dispatch(showModal("game-paused"));
    } catch (e) {
    } finally {
    }
}
