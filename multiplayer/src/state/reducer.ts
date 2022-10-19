import { AppState } from "./state";
import { Action } from "./actions";
import { defaultPresence } from "../types";

// The reducer's job is to apply state changes by creating a copy of the existing state with the change applied.
// The reducer must not create side effects. E.g. do not dispatch a state change from within the reducer.
export default function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case "SET_USER_PROFILE": {
            return {
                ...state,
                profile: action.profile,
                signedIn: !!action.profile?.id,
            };
        }
        case "SET_UI_MODE": {
            return {
                ...state,
                gameState: undefined,
                presence: { ...defaultPresence },
                appMode: {
                    ...state.appMode,
                    uiMode: action.mode,
                    netMode: "init",
                },
            };
        }
        case "SET_NET_MODE": {
            return {
                ...state,
                appMode: {
                    ...state.appMode,
                    netMode: action.mode,
                },
            };
        }
        case "SET_GAME_INFO": {
            return {
                ...state,
                gameState: {
                    ...state.gameState,
                    ...action.gameInfo,
                },
            };
        }
        case "SET_GAME_ID": {
            return {
                ...state,
                gameId: action.gameId,
            };
        }
        case "SET_PLAYER_SLOT": {
            return {
                ...state,
                playerSlot: action.playerSlot,
            };
        }
        case "CLEAR_GAME_INFO": {
            return {
                ...state,
                gameState: undefined,
            };
        }
        case "SET_GAME_MODE": {
            return {
                ...state,
                gameState: {
                    ...state.gameState,
                    gameMode: action.gameMode,
                },
            };
        }
        case "SHOW_TOAST": {
            return {
                ...state,
                toasts: [...state.toasts, action.toast],
            };
        }
        case "DISMISS_TOAST": {
            return {
                ...state,
                toasts: state.toasts.filter(t => t.id !== action.id),
            };
        }
        case "SET_PRESENCE": {
            return {
                ...state,
                presence: { ...action.presence },
            };
        }
        case "SET_REACTION": {
            return {
                ...state,
                reactions: {
                    ...state.reactions,
                    [action.clientId]: {
                        id: action.reactionId,
                        index: action.index,
                    },
                },
            };
        }
        case "CLEAR_REACTION": {
            return {
                ...state,
                reactions: {
                    ...state.reactions,
                    [action.clientId]: undefined,
                },
            };
        }
        case "SHOW_MODAL": {
            return {
                ...state,
                modal: action.modalType,
            };
        }
        case "CLEAR_MODAL": {
            return {
                ...state,
                modal: undefined,
            };
        }
    }
}
