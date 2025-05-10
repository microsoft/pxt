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

import * as collabClient from "@/services/collabClient";
import { ClientRole, SessionOverReason, ValueType } from "@/types";
import { notifyDisconnected } from "./notifyDisconnected";
import { joinedSessionAsync } from "./joinedSessionAsync";

export function init() {
    collabClient.on("disconnected", (reason?: SessionOverReason) => {
        notifyDisconnected(reason);
    });
    collabClient.on("joined", async (role: ClientRole, clientId: string) => {
        await joinedSessionAsync(role, clientId);
    });
    collabClient.on("signal", async (signal: string, payload: ValueType) => {
    });
}
