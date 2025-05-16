export { setUserProfileAsync } from "./setUserProfileAsync";
export { userSignedInAsync } from "./userSignedInAsync";
export { notifyDisconnected } from "./notifyDisconnected";
export { showModal } from "./showModal";
export { dismissModal } from "./dismissModal";
export { showToast } from "./showToast";
export { dismissToast } from "./dismissToast";
export { hostSessionAsync } from "./hostSessionAsync";
export { joinSessionAsync } from "./joinSessionAsync";
export { joinedSessionAsync } from "./joinedSessionAsync";
export { startLoadingGame } from "./startLoadingGame";
export { setPlatoExtInfo } from "./setPlatoExtInfo";
export { setPlayerValue } from "./setPlayerValue";
export { clearPlayerCurrentGames } from "./clearPlayerCurrentGames";
export { sendGameSuggestionAsync } from "./sendGameSuggestionAsync";

import * as collabClient from "@/services/collabClient";
import { ClientRole, SessionOverReason, ValueType } from "@/types";
import { notifyDisconnected } from "./notifyDisconnected";
import { joinedSessionAsync } from "./joinedSessionAsync";
import { recvPlayerJoinGame } from "./recvPlayerJoinGame";
import { recvPlayerLeaveGame } from "./recvPlayerLeaveGame";
import { recvChatMessageSignal } from "./recvChatMessageSignal";
import { recvRestartGameSignal } from "./recvRestartGameSignal";

export function init() {
    collabClient.on("disconnected", (reason?: SessionOverReason) => {
        notifyDisconnected(reason);
    });
    collabClient.on("joined", async (role: ClientRole, clientId: string) => {
        // Local client has joined the session
        await joinedSessionAsync(role, clientId);
    });
    collabClient.on("signal", async (signal: string, fromClientId: string, payload?: ValueType) => {
        // Somebody (maybe the local client) sent a signal to the session
        switch (signal) {
            case "chat":
                return recvChatMessageSignal(fromClientId, payload as string);
            case "restart-game":
                return recvRestartGameSignal();
        }
    });

    collabClient.playerPresenceStore.on("recv-player-joined-game", (clientId: string, currentGame: string) => {
        // a client joined a plato-enabled game
        recvPlayerJoinGame(clientId, currentGame);
    });
    collabClient.playerPresenceStore.on("recv-player-left-game", (clientId: string) => {
        // a client left a plato-enabled game
        recvPlayerLeaveGame(clientId);
    });

    collabClient.sessionStore.on("player-joined-session", (clientId: string) => {
        // a client joined the session
    });
    collabClient.sessionStore.on("player-left-session", (clientId: string) => {
        // a client left the session
        recvPlayerLeaveGame(clientId);
    });
}
