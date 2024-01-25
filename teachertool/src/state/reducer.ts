import { AppState } from "./state";
import { Action } from "./actions";

// The reducer's job is to apply state changes by creating a copy of the existing state with the change applied.
// The reducer must not create side effects. E.g. do not dispatch a state change from within the reducer.
export default function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case "POST_NOTIFICATION": {
            // Before posting the notification, ensure is doesn't already exist in the list.
            // Protect against duplicate action dispatches.
            if (
                !state.notifications.find(n => n.id === action.notification.id)
            ) {
                return {
                    ...state,
                    notifications: [
                        ...state.notifications,
                        action.notification,
                    ],
                };
            } else {
                return state;
            }
        }
        case "REMOVE_NOTIFICATION": {
            const notifications = state.notifications.filter(
                n => n.id !== action.notificationId
            );
            return {
                ...state,
                notifications,
            };
        }
        case "SET_PROJECT_METADATA": {
            return {
                ...state,
                projectMetadata: action.metadata,
            };
        }
        case "SET_EVAL_RESULT": {
            return {
                ...state,
                currentEvalResult: action.result,
            };
        }
        case "SET_CATALOG": {
            return {
                ...state,
                catalog: action.catalog,
            };
        }
        case "SET_SELECTED_CRITERIA": {
            return {
                ...state,
                selectedCriteria: [...action.criteria],
            };
        }
        case "REMOVE_CRITERIA_INSTANCE": {
            return {
                ...state,
                selectedCriteria: state.selectedCriteria.filter(c => c.instanceId !== action.instanceId)
            };
        }
        case "SHOW_MODAL": {
            return {
                ...state,
                modal: action.modal,
            };
        }
        case "HIDE_MODAL": {
            return {
                ...state,
                modal: undefined,
            };
        }
        case "SET_TARGET_CONFIG": {
            return {
                ...state,
                targetConfig: action.config,
            };
        }
    }
}
