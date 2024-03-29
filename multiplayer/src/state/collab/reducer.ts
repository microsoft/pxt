import { CollabState, initialState } from "./state";
import { CollabAction } from "./actions";

export function reducer(state: CollabState, action: CollabAction): CollabState {
    switch (action.type) {
        case "INIT":
            return {
                ...initialState,
            };
        case "PLAYER_JOINED":
            return {
                ...state,
                players: {
                    ...state.players,
                    [action.playerId]: {
                        clientId: action.playerId,
                        name: "Player " + action.playerId,
                        xp: 0,
                        yp: 0,
                    },
                },
            };
        case "PLAYER_LEFT":
            const { [action.playerId]: _, ...players } = state.players;
            return {
                ...state,
                players,
            };
    }
}
