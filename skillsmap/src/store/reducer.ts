import * as actions from '../actions/types'

export interface SkillsMapState {
    user: UserState;
    maps: { [key: string]: SkillsMap };
    selectedItem?: string;
}

const initialState: SkillsMapState = {
    user: {
        mapProgress: {},
        completedTags: {}
    },
    maps: {}
}

const topReducer = (state: SkillsMapState = initialState, action: any): SkillsMapState => {
    switch (action.type) {
        case actions.ADD_SKILLS_MAP:
            return {
                ...state,
                user: {
                    ...state.user,
                    mapProgress: {
                        ...state.user.mapProgress,
                        [action.id]: { mapId: action.map.id, activityState: {} }
                    }
                },
                maps: {
                    ...state.maps,
                    [action.map.mapId]: action.map
                }
            }
        case actions.CLEAR_SKILLS_MAPS:
            return {
                ...state,
                maps: {}
            };
        case actions.CHANGE_SELECTED_ITEM:
            return {
                ...state,
                selectedItem: action.id
            };
        case actions.SET_HEADERID_FOR_ACTIVITY:
            return {
                ...state,
                user: {
                    ...state.user,
                    mapProgress: {
                        ...state.user.mapProgress,
                        [action.id]: { mapId: action.map.id, activityState: {} }
                    }
                }
            }
        default:
            return state
    }
}

export default topReducer;