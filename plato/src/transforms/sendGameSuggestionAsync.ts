import { getGameMetadataAsync } from "@/services/helpers";
import { ChatMessagePayload } from "@/types";
import * as collabClient from "@/services/collabClient";

export async function sendGameSuggestionAsync(shareCode: string) {
    // Fetch game metadata
    const meta = await getGameMetadataAsync(shareCode);

    if (!meta || !meta.title) {
        return;
    }

    const payload: ChatMessagePayload = {
        type: "game",
        shareCode,
        title: meta.title,
        description: meta.description,
        thumbnailUrl: meta.thumbnailUrl,
    }

    collabClient.sendChatMessage(payload);
}
