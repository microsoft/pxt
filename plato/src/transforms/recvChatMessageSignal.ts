
import * as collabClient from "@/services/collabClient";
import { stateAndDispatch } from "@/state";
import { ChatMessage, ChatMessagePayload } from "@/types";

let chatMessageId = 0;

export function recvChatMessageSignal(fromClientId: string, payload_s: string) {
    const { state } = stateAndDispatch();
    const { netState } = state;
    if (!netState) return;

    // Only hosts should process this message
    if (netState.clientRole !== "host") return;

    if (!payload_s?.length) return;

    const players = collabClient.playerPresenceStore.getSnapshot();
    if (!players.find(p => p.id === fromClientId)) return;

    const nextChatId = ++chatMessageId;
    const payload = JSON.parse(payload_s) as ChatMessagePayload;

    const chatMessage: ChatMessage = {
        id: nextChatId,
        fromClientId,
        payload
    };

    collabClient.setSessionValue(`chat/${nextChatId}`, JSON.stringify(chatMessage));
}
