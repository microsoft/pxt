import * as actions from './types'

export const dispatchAddSkillsMap = (map: SkillsMap) => ({ type: actions.ADD_SKILLS_MAP, map });
export const dispatchClearSkillsMaps = () => ({ type: actions.CLEAR_SKILLS_MAPS });
export const dispatchChangeSelectedItem = (id: string) => ({ type: actions.CHANGE_SELECTED_ITEM, id });