import { state, dispatch } from "../state";
import * as gameClient from "../services/gameClient";
import { setGamePaused } from "../state/actions";
import { simDriver } from "../services/simHost";

export async function resumeGameAsync() {
    const { clientRole } = state;

    try {
        if (clientRole === "host") {
            pxt.tickEvent("mp.host.resumegame");
            await gameClient.resumeGameAsync();
        }
        simDriver()?.resume(pxsim.SimulatorDebuggerCommand.Resume);
        dispatch(setGamePaused(false));
    } catch (e) {
    } finally {
    }
}
