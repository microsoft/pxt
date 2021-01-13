import { PageSourceStatus } from '../store/reducer';
import * as actions from './types'

export const dispatchAddSkillMap = (map: SkillMap) => ({ type: actions.ADD_SKILL_MAP, map });
export const dispatchClearSkillMaps = () => ({ type: actions.CLEAR_SKILL_MAPS });
export const dispatchChangeSelectedItem = (id?: string) => ({ type: actions.CHANGE_SELECTED_ITEM, id });
export const dispatchSetSkillMapCompleted = (mapId: string) => ({ type: actions.SET_SKILL_MAP_COMPLETED, mapId });

export const dispatchSetHeaderIdForActivity = (mapId: string, activityId: string, id: string, currentStep: number, maxSteps: number, isCompleted: boolean) => ({ type: actions.SET_HEADERID_FOR_ACTIVITY, mapId, activityId, id, currentStep, maxSteps, isCompleted });
export const dispatchOpenActivity = (mapId: string, activityId: string) => ({ type: actions.OPEN_ACTIVITY, mapId, activityId });
export const dispatchCloseActivity = (finished = false) => ({ type: actions.CLOSE_ACTIVITY, finished });
export const dispatchSaveAndCloseActivity = () => ({ type: actions.SAVE_AND_CLOSE_ACTIVITY });
export const dispatchRestartActivity = (mapId: string, activityId: string) => ({ type: actions.RESTART_ACTIVITY, mapId, activityId });

export const dispatchSetUser = (user: UserState) => ({ type: actions.SET_USER, user });
export const dispatchUpdateUserCompletedTags = () => ({ type: actions.UPDATE_USER_COMPLETED_TAGS });
export const dispatchResetUser = () => ({ type: actions.RESET_USER });

export const dispatchSetPageTitle = (title: string) => ({ type: actions.SET_PAGE_TITLE, title });
export const dispatchSetPageDescription = (description: string) => ({ type: actions.SET_PAGE_DESCRIPTION, description });
export const dispatchSetPageInfoUrl = (infoUrl: string) => ({ type: actions.SET_PAGE_INFO_URL, infoUrl });
export const dispatchSetPageSourceUrl = (url: string, status: PageSourceStatus) => ({ type: actions.SET_PAGE_SOURCE_URL, url, status });

export const dispatchShowCompletionModal = (mapId: string, activityId?: string) => ({ type: actions.SHOW_COMPLETION_MODAL, mapId, activityId });
export const dispatchShowRestartActivityWarning = (mapId: string, activityId: string) => ({ type: actions.SHOW_RESTART_ACTIVITY_MODAL, mapId, activityId });
export const dispatchShowReportAbuseModal = () => ({ type: actions.SHOW_REPORT_ABUSE_MODAL });
export const dispatchShowResetUserModal = () => ({ type: actions.SHOW_RESET_USER_MODAL });

export const dispatchHideModal = () => ({ type: actions.HIDE_MODAL });