import { state, dispatch } from "../state";
import * as gameClient from "../services/gameClient";
import { setGamePaused } from "../state/actions";
import { simDriver } from "../services/simHost";
import { SimMultiplayer } from "../types";

export async function resumeGameAsync() {
    const { clientRole, presence } = state;

    try {
        if (clientRole === "host") {
            pxt.tickEvent("mp.host.resumegame");
            await gameClient.resumeGameAsync();
        }
        simDriver()?.resume(pxsim.SimulatorDebuggerCommand.Resume);
        dispatch(setGamePaused(false));
        if (clientRole === "host") {
            for (let i = 1; i <= 4; i++) {
                const nowConnected = !!presence.users.find(el => el.slot === i);
                simDriver()?.postMessage({
                    type: "multiplayer",
                    content: "Connection",
                    slot: i,
                    connected: nowConnected,
                } as SimMultiplayer.MultiplayerConnectionMessage);
            }
            await gameClient.sendCurrentScreenAsync();
        }
    } catch (e) {
    } finally {
    }
}
