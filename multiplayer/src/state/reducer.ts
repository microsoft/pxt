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
                authStatus: !!action.profile?.id ? "signed-in" : "signed-out",
            };
        }
        case "SET_CLIENT_ROLE": {
            return {
                ...state,
                clientRole: action.clientRole,
            };
        }
        case "SET_NET_MODE": {
            let nextState = {
                ...state,
                netMode: action.mode,
            };
            if (action.mode === "init") {
                // Clear lots of state when we go back to init mode
                nextState = {
                    ...nextState,
                    clientRole: undefined,
                    playerSlot: undefined,
                    joinCode: undefined,
                    gameState: undefined,
                    gameMetadata: undefined,
                    gamePaused: undefined,
                    collabInfo: undefined,
                    presence: { ...defaultPresence },
                    modal: undefined,
                    modalOpts: undefined,
                };
            }
            return nextState;
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
        case "SET_COLLAB_INFO": {
            return {
                ...state,
                collabInfo: {
                    ...action.collabInfo,
                },
            };
        }
        case "SET_GAME_METADATA": {
            return {
                ...state,
                gameMetadata: action.gameMetadata,
            };
        }
        case "SET_GAME_ID": {
            return {
                ...state,
                gameState: {
                    ...state.gameState,
                    gameId: action.gameId,
                },
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
                playerSlot: undefined,
                gameState: undefined,
                gameMetadata: undefined,
                collabInfo: undefined,
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
                modalOpts: action.modalOpts,
            };
        }
        case "CLEAR_MODAL": {
            return {
                ...state,
                modal: undefined,
                modalOpts: undefined,
            };
        }
        case "SET_DEEP_LINKS": {
            return {
                ...state,
                deepLinks: {
                    shareCode: action.shareCode,
                    joinCode: !action.shareCode ? action.joinCode : undefined,
                },
            };
        }
        case "SET_MUTE": {
            return {
                ...state,
                muted: action.value,
            };
        }
        case "SET_GAME_PAUSED": {
            return {
                ...state,
                gamePaused: action.gamePaused,
            };
        }
        case "SET_TARGET_CONFIG": {
            return {
                ...state,
                targetConfig: action.targetConfig,
            };
        }
        case "SET_PRESENCE_ICON_OVERRIDE": {
            let nextPresenceIcon =
                state.gameState?.presenceIconOverrides?.slice() || [];
            nextPresenceIcon[action.slot] = action.icon;
            return {
                ...state,
                gameState: {
                    ...state.gameState,
                    presenceIconOverrides: nextPresenceIcon,
                },
            };
        }
        case "SET_REACTION_ICON_OVERRIDE": {
            let nextReactionIcons =
                state.gameState?.reactionIconOverrides?.slice() || [];
            nextReactionIcons[action.slot] = action.icon;
            return {
                ...state,
                gameState: {
                    ...state.gameState,
                    reactionIconOverrides: nextReactionIcons,
                },
            };
        }
    }
}
