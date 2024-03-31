import { CollabPlayer } from "../../services/collabClient";

export type CollabState = {
    players: { [playerId: string]: CollabPlayer };
    kv: Map<string, string>;
};

export const initialState: CollabState = {
    players: {},
    kv: new Map(),
};
