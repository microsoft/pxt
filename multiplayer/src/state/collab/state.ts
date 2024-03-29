import { CollabPlayer } from "../../services/collabClient"

export type CollabState = {
    players: { [playerId: string]: CollabPlayer };
};

export const initialState: CollabState = {
    players: {},
};
