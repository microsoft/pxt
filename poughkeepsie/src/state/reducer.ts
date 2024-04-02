import { AppState } from "./state";
import { Action } from "./actions";
import { updateAsset } from "../utils/project";

// The reducer's job is to apply state changes by creating a copy of the existing state with the change applied.
// The reducer must not create side effects. E.g. do not dispatch a state change from within the reducer.
export default function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case "SET_TARGET_CONFIG": {
            return {
                ...state,
                targetConfig: action.config,
            };
        }
        case "UPDATE_IMAGE_ASSET": {
            return {
                ...state,
                project: updateAsset(state.project, action.newValue)
            };
        }
        case "UPDATE_TILEMAP_ASSET": {
            return {
                ...state,
                project: updateAsset(state.project, action.newValue)
            };
        }
        case "UPDATE_PROJECT": {
            return {
                ...state,
                project: action.project
            }
        }
        case "SET_ACTIVE_IMAGE_ASSET": {
            return {
                ...state,
                currentImageId: action.assetId
            }
        }
        case "SET_ACTIVE_IMAGE_TAB": {
            return {
                ...state,
                activeImageTab: action.tab
            }
        }
    }
}
