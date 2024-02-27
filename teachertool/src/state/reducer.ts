import { AppState } from "./state";
import { Action } from "./actions";
import { updateStoredRubricAsync } from "../transforms/updateStoredRubric";

// The reducer's job is to apply state changes by creating a copy of the existing state with the change applied.
// The reducer must not create side effects. E.g. do not dispatch a state change from within the reducer.
export default function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case "SHOW_TOAST": {
            // Before posting the notification, ensure is doesn't already exist in the list.
            // Protect against duplicate action dispatches.
            if (!state.toasts.find(n => n.id === action.toast.id)) {
                return {
                    ...state,
                    toasts: [...state.toasts, action.toast],
                };
            } else {
                return state;
            }
        }
        case "DISMISS_TOAST": {
            const toasts = state.toasts.filter(n => n.id !== action.toastId);
            return {
                ...state,
                toasts,
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
                evalResults: {
                    ...state.evalResults,
                    [action.criteriaInstanceId]: action.result,
                },
            };
        }
        case "CLEAR_EVAL_RESULT": {
            const evalResults = { ...state.evalResults };
            delete evalResults[action.criteriaInstanceId];
            return {
                ...state,
                evalResults,
            };
        }
        case "CLEAR_ALL_EVAL_RESULTS": {
            return {
                ...state,
                evalResults: {},
            };
        }
        case "SET_CATALOG": {
            return {
                ...state,
                catalog: action.catalog,
            };
        }
        case "SET_RUBRIC": {
            /*await*/ updateStoredRubricAsync(state.rubric, action.rubric); // fire and forget, we don't need to wait for this to finish.
            return {
                ...state,
                rubric: action.rubric,
            };
        }
        case "SET_CONFIRMATION_PROPS": {
            return {
                ...state,
                confirmationProps: action.props,
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
        case "SET_VALIDATOR_PLANS": {
            return {
                ...state,
                validatorPlans: action.plans,
            };
        }
        case "SET_TARGET_CONFIG": {
            return {
                ...state,
                targetConfig: action.config,
            };
        }
        case "SET_ACTIVE_TAB": {
            return {
                ...state,
                activeTab: action.tabName,
            };
        }
        case "SET_AUTORUN": {
            return {
                ...state,
                autorun: action.autorun,
            };
        }
    }
}
