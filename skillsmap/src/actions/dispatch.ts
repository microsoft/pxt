import * as actions from './types'

export const dispatchAddSkillsMap = (map: SkillsMap) => ({ type: actions.ADD_SKILLS_MAP, map });
export const dispatchClearSkillsMaps = () => ({ type: actions.CLEAR_SKILLS_MAPS });
export const dispatchChangeSelectedItem = (id: string) => ({ type: actions.CHANGE_SELECTED_ITEM, id });
export const dispatchSetHeaderIdForActivity = (id: string) => ({ type: actions.SET_HEADERID_FOR_ACTIVITY, id });
export const dispatchOpenActivity = (mapId: string, activityId: string) => ({ type: actions.OPEN_ACTIVITY, mapId, activityId });
export const dispatchCloseActivity = () => ({ type: actions.CLOSE_ACTIVITY });

export const dispatchSetPageTitle = (title: string) => ({ type: actions.SET_PAGE_TITLE, title });
export const dispatchSetPageDescription = (description: string) => ({ type: actions.SET_PAGE_DESCRIPTION, description });
export const dispatchSetPageInfoUrl = (infoUrl: string) => ({ type: actions.SET_PAGE_INFO_URL, infoUrl });

export const dispatchShowCompletionModal = (mapId: string, activityId: string) => ({ type: actions.SHOW_COMPLETION_MODAL, mapId, activityId });
export const dispatchHideCompletionModal = () => ({ type: actions.HIDE_COMPLETION_MODAL });
