import * as gameClient from "../services/gameClient";
import { dispatch } from "../state";
import {
    dismissToast,
    setNetMode,
    setGameInfo,
    showToast,
    setGameId,
    setClientRole,
} from "../state/actions";

export async function hostGameAsync(shareCode: string | undefined) {
    shareCode = pxt.Cloud.parseScriptId(shareCode ?? "");
    if (!shareCode) {
        return dispatch(
            showToast({
                type: "error",
                text: lf("Invalid share code or link. Please try again."),
                timeoutMs: 5000,
            })
        );
    }
    const connectingToast = showToast({
        type: "info",
        text: lf("Connecting..."),
        showSpinner: true,
    });
    try {
        dispatch(setNetMode("connecting"));
        dispatch(connectingToast);

        const gameInfo = await gameClient.hostGameAsync(shareCode);
        console.log(gameInfo);

        dispatch(
            showToast({
                type: "success",
                text: lf("Connected!"),
                timeoutMs: 5000,
            })
        );

        dispatch(setClientRole("host"));
        dispatch(setGameInfo(gameInfo));
        dispatch(setGameId(shareCode));
        dispatch(setNetMode("connected"));
    } catch (e) {
        console.log("error", e);
        dispatch(setNetMode("init"));
        dispatch(
            showToast({
                type: "error",
                text: lf("Something went wrong. Please try again."),
                timeoutMs: 5000,
            })
        );
    } finally {
        dispatch(dismissToast(connectingToast.toast.id));
    }
}
