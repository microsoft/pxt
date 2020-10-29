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
            state.user.mapProgress[action.id] = { mapId: action.map.id, activityState: {} };
            state.maps[action.map.mapId] = action.map;
            return state
        case actions.CHANGE_SELECTED_ITEM:
            return {
                ...state,
                selectedItem: action.id
            };
        default:
            return state
    }
}

export default topReducer;