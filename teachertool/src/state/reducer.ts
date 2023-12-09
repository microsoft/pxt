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
    }

    return state;
}
