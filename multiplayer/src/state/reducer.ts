import { AppState } from "./state";
import { Action } from "./actions";

// The reducer's job is to apply state changes by creating a copy of the existing state with the change applied.
// The reducer must not create side effects. E.g. do not dispatch a state change from within the reducer.
export default function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case "SET_MOTD": {
            return {
                ...state,
                motd: action.motd,
            };
        }
        case "SET_USER_PROFILE": {
            return {
                ...state,
                profile: action.profile,
                signedIn: !!action.profile?.id,
            };
        }
    }
}
