import * as collabClient from "@/services/collabClient";

export function startLoadingGame(shareCode: string): void {
    const session = collabClient.sessionStore.getSnapshot();
    if (session.shareCode !== shareCode) {
        collabClient.loadGame(shareCode);
    } else if (shareCode) {
        collabClient.sendRestartGameSignal();
    }
}
