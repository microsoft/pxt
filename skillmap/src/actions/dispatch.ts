import * as actions from './types'

export const dispatchAddSkillMap = (map: SkillMap) => ({ type: actions.ADD_SKILL_MAP, map });
export const dispatchClearSkillMaps = () => ({ type: actions.CLEAR_SKILL_MAPS });
export const dispatchChangeSelectedItem = (id: string) => ({ type: actions.CHANGE_SELECTED_ITEM, id });
export const dispatchSetHeaderIdForActivity = (id: string, currentStep: number, maxSteps: number) => ({ type: actions.SET_HEADERID_FOR_ACTIVITY, id, currentStep, maxSteps });
export const dispatchOpenActivity = (mapId: string, activityId: string) => ({ type: actions.OPEN_ACTIVITY, mapId, activityId });
export const dispatchCloseActivity = (finished = false) => ({ type: actions.CLOSE_ACTIVITY, finished });
export const dispatchSaveAndCloseActivity = () => ({ type: actions.SAVE_AND_CLOSE_ACTIVITY });
export const dispatchRestartActivity = (mapId: string, activityId: string) => ({ type: actions.RESTART_ACTIVITY, mapId, activityId });


export const dispatchSetPageTitle = (title: string) => ({ type: actions.SET_PAGE_TITLE, title });
export const dispatchSetPageDescription = (description: string) => ({ type: actions.SET_PAGE_DESCRIPTION, description });
export const dispatchSetPageInfoUrl = (infoUrl: string) => ({ type: actions.SET_PAGE_INFO_URL, infoUrl });

export const dispatchShowCompletionModal = (mapId: string, activityId?: string) => ({ type: actions.SHOW_COMPLETION_MODAL, mapId, activityId });
export const dispatchHideModal = () => ({ type: actions.HIDE_MODAL });

export const dispatchShowRestartActivityWarning = (mapId: string, activityId: string) => ({ type: actions.SHOW_RESTART_ACTIVITY_MODAL, mapId, activityId });
