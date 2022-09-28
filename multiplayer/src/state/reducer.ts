import { AppState } from "./state"
import { Action } from "./actions"

// The reducer's job is to apply state changes by creating a copy of the existing state with the change applied.
// The reducer must not create side effects. E.g. do not dispatch a state change from within the reducer.
export default function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case "SET_USER_PROFILE": {
            return {
                ...state,
                profile: action.profile,
                signedIn: !!action.profile?.id
            }
        }
        case "SET_GAME_MODE": {
            return {
                ...state,
                gameMode: action.gameMode,
                gameStatus: "init"
            }
        }
        case "SET_GAME_STATUS": {
            return {
                ...state,
                gameStatus: action.gameStatus
            }
        }
        case "SET_GAME_ID": {
            return {
                ...state,
                gameId: action.gameId
            }
        }
        case "SET_GAME_INFO": {
            return {
                ...state,
                gameInfo: {
                    ...action.gameInfo
                }
            }
        }
        case "SET_ERROR_MESSAGE": {
            return {
                ...state,
                errorMessage: action.message
            }
        }
    }
}
