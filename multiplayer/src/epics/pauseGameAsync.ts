import { state, dispatch } from "../state";
import * as gameClient from "../services/gameClient";
import { setGamePaused } from "../state/actions";
import { simDriver } from "../services/simHost";

export async function pauseGameAsync() {
    const { clientRole } = state;

    try {
        if (clientRole === "host") {
            pxt.tickEvent("mp.host.pausegame");
            await gameClient.pauseGameAsync();
        }
        simDriver()?.resume(pxsim.SimulatorDebuggerCommand.Pause);
        dispatch(setGamePaused(true));
    } catch (e) {
    } finally {
    }
}
