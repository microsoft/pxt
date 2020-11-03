import * as actions from './types'

export const dispatchAddSkillsMap = (map: SkillsMap) => ({ type: actions.ADD_SKILLS_MAP, map });
export const dispatchClearSkillsMaps = () => ({ type: actions.CLEAR_SKILLS_MAPS });
export const dispatchChangeSelectedItem = (id: string) => ({ type: actions.CHANGE_SELECTED_ITEM, id });
export const dispatchSetHeaderIdForActivity = (id: string) => ({ type: actions.SET_HEADERID_FOR_ACTIVITY, id });
export const dispatchOpenActivity = (mapId: string, activityId: string) => ({ type: actions.OPEN_ACTIVITY, mapId, activityId });
export const dispatchCloseActivity = () => ({ type: actions.CLOSE_ACTIVITY });