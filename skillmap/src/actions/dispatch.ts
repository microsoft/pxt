import { ShareData } from 'react-common/components/share/Share';
import { ReadyResources } from '../lib/readyResources';
import { ModalState, PageSourceStatus } from '../store/reducer';
import * as actions from './types'

export const dispatchAddSkillMap = (map: SkillMap) => ({ type: actions.ADD_SKILL_MAP, map });
export const dispatchClearSkillMaps = () => ({ type: actions.CLEAR_SKILL_MAPS });
export const dispatchClearMetadata = () => ({ type: actions.CLEAR_METADATA });
export const dispatchChangeSelectedItem = (mapId?: string, activityId?: string) => ({ type: actions.CHANGE_SELECTED_ITEM, mapId, activityId });
export const dispatchSetSkillMapCompleted = (mapId: string) => ({ type: actions.SET_SKILL_MAP_COMPLETED, mapId });

export const dispatchSetHeaderIdForActivity = (mapId: string, activityId: string, id: string, currentStep: number, maxSteps: number, isCompleted: boolean) => ({ type: actions.SET_HEADERID_FOR_ACTIVITY, mapId, activityId, id, currentStep, maxSteps, isCompleted });
export const dispatchOpenActivity = (mapId: string, activityId: string, previousHeaderId?: string, carryoverCode?: boolean) => ({ type: actions.OPEN_ACTIVITY, mapId, activityId, previousHeaderId, carryoverCode });
export const dispatchCloseActivity = (finished = false) => ({ type: actions.CLOSE_ACTIVITY, finished });
export const dispatchSaveAndCloseActivity = () => ({ type: actions.SAVE_AND_CLOSE_ACTIVITY });
export const dispatchRestartActivity = (mapId: string, activityId: string, previousHeaderId?: string, carryoverCode?: boolean) => ({ type: actions.RESTART_ACTIVITY, mapId, activityId, previousHeaderId, carryoverCode });
export const dispatchSetUser = (user: UserState) => ({ type: actions.SET_USER, user });
export const dispatchUpdateUserCompletedTags = () => ({ type: actions.UPDATE_USER_COMPLETED_TAGS });
export const dispatchResetUser = () => ({ type: actions.RESET_USER });

export const dispatchSetPageTitle = (title: string) => ({ type: actions.SET_PAGE_TITLE, title });
export const dispatchSetPageDescription = (description: string) => ({ type: actions.SET_PAGE_DESCRIPTION, description });
export const dispatchSetPageInfoUrl = (infoUrl: string) => ({ type: actions.SET_PAGE_INFO_URL, infoUrl });
export const dispatchSetPageBackgroundImageUrl = (backgroundImageUrl: string) => ({ type: actions.SET_PAGE_BACKGROUND_IMAGE_URL, backgroundImageUrl });
export const dispatchSetPageBannerImageUrl = (bannerImageUrl: string) => ({ type: actions.SET_PAGE_BANNER_IMAGE_URL, bannerImageUrl });
export const dispatchSetPageTheme = (theme: SkillGraphTheme) => ({ type: actions.SET_PAGE_THEME, theme });
export const dispatchSetPageSourceUrl = (url: string, status: PageSourceStatus) => ({ type: actions.SET_PAGE_SOURCE_URL, url, status });
export const dispatchSetPageAlternateUrls = (urls: string[]) => ({ type: actions.SET_PAGE_ALTERNATE_URLS, urls });


export const dispatchHideModal = () => ({ type: actions.HIDE_MODAL });

export const dispatchSetUserProfile = (profile?: pxt.auth.UserProfile) => ({ type: actions.SET_USER_PROFILE, profile });
export const dispatchSetUserPreferences = (preferences?: pxt.auth.UserPreferences) => ({ type: actions.SET_USER_PREFERENCES, preferences });
export const dispatchLogout = () => ({ type: actions.USER_LOG_OUT });
export const dispatchShowUserProfile = () => ({ type: actions.SHOW_USER_PROFILE });
export const dispatchCloseUserProfile = () => ({ type: actions.HIDE_USER_PROFILE });
export const dispatchShowSelectLanguage = () => ({ type: actions.SHOW_SELECT_LANGUAGE });
export const dispatchCloseSelectLanguage = () => ({ type: actions.HIDE_SELECT_LANGUAGE });
export const dispatchShowSelectTheme = () => ({ type: actions.SHOW_SELECT_THEME });
export const dispatchCloseSelectTheme = () => ({ type: actions.HIDE_SELECT_THEME });
export const dispatchShowFeedback = () => ({ type: actions.SHOW_FEEDBACK });
export const dispatchCloseFeedback = () => ({ type: actions.HIDE_FEEDBACK });

export const dispatchSetShareStatus = (headerId?: string, projectName?: string, data?: ShareData) =>  ({ type: actions.SET_SHARE_STATUS, headerId, projectName, data });
export const dispatchSetCloudStatus = (headerId: string, status: string) => ({ type: actions.SET_CLOUD_STATUS, headerId, status });
export const dispatchSetReadyResources = (resources: ReadyResources) => ({ type: actions.SET_READY_RESOURCES, resources });
export const dispatchGrantSkillmapBadge = (mapId: string) => ({ type: actions.GRANT_SKILLMAP_BADGE, mapId });

export const dispatchShowCompletionModal = (mapId: string, activityId?: string) => ({ type: actions.SHOW_COMPLETION_MODAL, mapId, activityId });
export const dispatchShowCarryoverModal = (mapId: string, activityId: string) => dispatchSetModal({ type: "carryover", currentMapId: mapId, currentActivityId: activityId });
export const dispatchShowRestartActivityWarning = (mapId: string, activityId: string) => dispatchSetModal({ type: "restart-warning", currentMapId: mapId,currentActivityId:  activityId });
export const dispatchShowReportAbuseModal = () => dispatchSetModal({ type: "report-abuse" });
export const dispatchShowResetUserModal = () => dispatchSetModal({ type: "reset" });
export const dispatchShowShareModal = (mapId: string, activityId: string, rewardsShare?: boolean) => dispatchSetModal({ type: "share", currentMapId: mapId, currentActivityId: activityId }, rewardsShare);
export const dispatchShowLoginModal = () => dispatchSetModal({ type: "login"});
export const dispatchShowLoginPrompt = () => dispatchSetModal({ type: "login-prompt"});
export const dispatchShowDeleteAccountModal = () => dispatchSetModal({ type: "delete-account" });

export const dispatchEnqueueModals = (modals: ModalState[]) => ({ type: actions.ENQUEUE_MODALS, modals })
export const dispatchSetModal = (modal: ModalState, rewardsShare?: boolean) => ({ type: actions.SET_MODAL, modal, rewardsShare })
export const dispatchNextModal = () => ({ type: actions.NEXT_MODAL })
