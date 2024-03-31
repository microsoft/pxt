import { CollabPlayer } from "../../services/collabClient";
import { CollabState } from "./state";

export { collabStateAndDispatch } from "./CollabContext";
export { CollabStateProvider, CollabContext } from "./CollabContext";

export function getCollabPlayers(state: CollabState): CollabPlayer[] {
    return Object.values(state.players);
}
