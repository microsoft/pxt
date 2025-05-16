
import * as collabClient from "@/services/collabClient";
import { stateAndDispatch } from "@/state";
import { ChatMessage } from "@/types";

let chatMessageId = 0;

export function recvChatMessageSignal(fromClientId: string, message: string) {
    const { state } = stateAndDispatch();
    const { netState } = state;
    if (!netState) return;

    // Only hosts should process this message
    if (netState.clientRole !== "host") return;

    if (!message?.length) return;

    const players = collabClient.playerPresenceStore.getSnapshot();
    if (!players.find(p => p.id === fromClientId)) return;

    const session = collabClient.sessionStore.getSnapshot();
    const nextChatId = ++chatMessageId;

    const chatMessage: ChatMessage = {
        id: nextChatId,
        fromClientId,
        payload: {
            type: "text",
            text: message,
        }
    };

    collabClient.setSessionValue(`chat/${nextChatId}`, JSON.stringify(chatMessage));
}
