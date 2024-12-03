import { Action } from "./action";
import { Reducer } from "./dataStore";
import { IAppState } from "./state";

export const reducer: Reducer<IAppState, Action> = (store, action) => {
    switch (action.type) {
        case "SET_EDITOR_TOOLS_COLLAPSED":
            return {
                ...store,
                collapseEditorTools: action.collapsed
            };
        case "SET_GREEN_SCREEN_ENABLED":
            return {
                ...store,
                greenScreen: action.enabled
            };
        case "SET_TAB_ACTIVE":
            return {
                ...store,
                active: action.active
            };
    }
}