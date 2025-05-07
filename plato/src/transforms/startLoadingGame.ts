import * as collabClient from "@/services/collabClient";

export function startLoadingGame(shareCode: string): void {
    collabClient.loadGame(shareCode);
}
