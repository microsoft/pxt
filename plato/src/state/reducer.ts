import { AppState } from "./state";
import { Action } from "./actions";

export function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case "SET_USER_PROFILE": {
            return { ...state, userProfile: action.payload.profile, authStatus: !!action.payload.profile?.id ? "signed-in" : "signed-out" };
        }
        case "SET_CLIENT_ROLE": {
            return { ...state, clientRole: action.payload.clientRole };
        }
        case "SET_NET_MODE": {
            return { ...state, netMode: action.payload.mode };
        }
        case "SET_COLLAB_INFO": {
            return { ...state, collabInfo: action.payload.collabInfo };
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
        case "SET_PRESENCE": {
            return {
                ...state,
                presence: { ...state.presence },
            };
        }
    }
}
