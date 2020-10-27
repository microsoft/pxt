import * as actions from '../actions/types'

export interface SkillsMapState {
    selectedItem?: string;
}

const initialState: SkillsMapState = {
}

const topReducer = (state: SkillsMapState = initialState, action: any): SkillsMapState => {
    switch (action.type) {
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