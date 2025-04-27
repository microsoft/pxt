import { AppState } from "./state";
import { Action } from "./actions";

export function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case "SET_USER_PROFILE": {
            return {
                ...state,
                userProfile: action.payload.profile,
                authStatus: !!action.payload.profile?.id ? "signed-in" : "signed-out",
            };
        }
        case "SHOW_TOAST": {
            return { ...state, toasts: [...state.toasts, action.payload.toast] };
        }
        case "DISMISS_TOAST": {
            return {
                ...state,
                toasts: state.toasts.filter(t => t.id !== action.payload.toastId),
            };
        }
        case "DISMISS_ALL_TOASTS": {
            return {
                ...state,
                toasts: [],
            };
        }
        case "SHOW_MODAL": {
            return {
                ...state,
                modalOptions: action.payload.modalOptions,
            };
        }
        case "DISMISS_MODAL": {
            return {
                ...state,
                modalOptions: undefined,
            };
        }
        case "SET_NET_STATE": {
            if (!action.payload.netState) {
                return {
                    ...state,
                    netState: undefined,
                };
            }
            if (!state.netState?.type && !action.payload.netState.type) {
                // If netState has no type, then incoming must have one.
                return {
                    ...state,
                    netState: undefined,
                };
            }
            return {
                ...state,
                netState: {
                    ...state.netState,
                    ...action.payload.netState,
                },
            };
        }
        case "SET_PRESENCE": {
            const { netState } = state;
            if (!netState) {
                return state;
            }
            return {
                ...state,
                netState: {
                    ...netState,
                    presence: {
                        ...action.payload.presence,
                    },
                },
            };
        }
    }
}
