import { CollabState, initialState } from "./state";
import { CollabAction } from "./actions";

export function reducer(state: CollabState, action: CollabAction): CollabState {
    switch (action.type) {
        case "INIT":
            return {
                ...initialState,
            };
        case "PLAYER_JOINED": {
            return {
                ...state,
                players: {
                    ...state.players,
                    [action.playerId]: {
                        clientId: action.playerId,
                        kv: action.kv ? action.kv : new Map(),
                    },
                },
            };
        }
        case "PLAYER_LEFT": {
            const { [action.playerId]: _, ...players } = state.players;
            return {
                ...state,
                players,
            };
        }
        case "SET_PLAYER_VALUE": {
            const player = state.players[action.playerId];
            if (player) {
                return {
                    ...state,
                    players: {
                        ...state.players,
                        [action.playerId]: {
                            ...player,
                            kv: new Map(player.kv).set(action.key, action.value),
                        },
                    },
                };
            } else {
                return state;
            }
        }
        case "DEL_PLAYER_VALUE": {
            const player = state.players[action.playerId];
            if (player) {
                const kv = new Map(player.kv);
                kv.delete(action.key);
                return {
                    ...state,
                    players: {
                        ...state.players,
                        [action.playerId]: {
                            ...player,
                            kv,
                        },
                    },
                };
            } else {
                return state;
            }
        }
        case "SET_SESSION_VALUE": {
            return {
                ...state,
                kv: new Map(state.kv).set(action.key, action.value),
            };
        }
        case "DEL_SESSION_VALUE": {
            const kv = new Map(state.kv);
            kv.delete(action.key);
            return {
                ...state,
                kv,
            };
        }
        case "SET_SESSION_STATE": {
            return {
                ...state,
                kv: action.sessKv,
            };
        }
        case "UPDATE_PRESENCE": {
            const players = { ...state.players };
            action.presence.users.forEach(user => {
                const player = players[user.id] ?? {
                    clientId: user.id,
                    kv: new Map(),
                };
                players[user.id] = {
                    ...player,
                    kv: user.kv ? user.kv : player.kv,
                };
            });
            return {
                ...state,
                players,
            };
        }
    }
}
