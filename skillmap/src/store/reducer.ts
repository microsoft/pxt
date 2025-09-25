import { ShareData } from 'react-common/components/share/Share';
import * as actions from '../actions/types'
import { guidGen, cloudLocalStoreKey } from '../lib/browserUtils';
import { ReadyResources } from '../lib/readyResources';
import { getCompletedTags, lookupActivityProgress, isMapCompleted,
    isRewardNode, applyUserUpgrades, applyUserMigrations } from '../lib/skillMapUtils';

export type ModalType = "restart-warning" | "completion" | "report-abuse" | "reset" | "carryover" | "share" | "login" | "login-prompt" | "delete-account" | "reward";
export type PageSourceStatus = "approved" | "banned" | "unknown";

// State for the entire page
export interface SkillMapState {
    title: string;
    description: string;
    infoUrl?: string;
    backgroundImageUrl?: string;
    pixellatedBackground?: boolean;
    bannerImageUrl?: string;
    user: UserState;
    pageSourceUrl: string;
    pageSourceStatus: PageSourceStatus;
    alternateSourceUrls?: string[];
    maps: { [key: string]: SkillMap };
    selectedItem?: { mapId: string, activityId: string };
    shareState?: ShareState;
    cloudState?: CloudState;
    editorView?: EditorViewState;
    modalQueue?: ModalState[];
    showProfile?: boolean;
    theme: SkillGraphTheme;
    auth: AuthState;
    readyResources?: ReadyResources;
    showSelectLanguage?: boolean;
    showSelectTheme?: boolean;
    colorThemeId?: string;
    showFeedback?: boolean;
}

export interface EditorViewState {
    currentHeaderId?: string;
    currentMapId: string;
    currentActivityId: string;
    allowCodeCarryover: boolean;
    previousHeaderId?: string;
    state: "active" | "saving";
}

export interface ModalState {
    type: ModalType;
    currentMapId?: string;
    currentActivityId?: string;
    currentReward?: MapReward;
}

export interface ShareState {
    headerId: string;
    projectName: string;
    data?: ShareData;
    rewardsShare?: boolean;
}

interface CloudState {
    [headerId: string]: pxt.cloud.CloudStatus;
}

interface AuthState {
    signedIn: boolean;
    profile?: pxt.auth.UserProfile;
    preferences?: pxt.auth.UserPreferences;
}

const initialState: SkillMapState = {
    title: lf("Game Maker Guide"),
    description: lf("Level up your game making skills by completing the tutorials in this guide."),
    pageSourceStatus: "unknown",
    pageSourceUrl: "default",
    user: {
        version: pxt.skillmap.USER_VERSION,
        isDebug: true,
        id: guidGen(),
        mapProgress: {},
        completedTags: {}
    },
    theme: {
        backgroundColor: "var(--pxt-target-background1)",
        pathColor: "var(--pxt-neutral-background1)",
        strokeColor: "var(--pxt-target-foreground1)",
        rewardNodeColor: "var(--pxt-primary-background)",
        rewardNodeForeground: "var(--pxt-primary-foreground)",
        unlockedNodeColor: "var(--pxt-secondary-background)",
        unlockedNodeForeground: "var(--pxt-secondary-foreground)",
        lockedNodeColor: "var(--pxt-neutral-background1)",
        lockedNodeForeground: "var(--pxt-neutral-foreground1)",
        completedNodeColor: "var(--pxt-secondary-background)",
        completedNodeForeground: "var(--pxt-secondary-foreground)",
        selectedStrokeColor: "var(--pxt-secondary-background)",
        pathOpacity: 0.5,
    },
    maps: {},
    auth: {
        signedIn: false
    },
    cloudState: {}
}

const topReducer = (state: SkillMapState = initialState, action: any): SkillMapState => {
    switch (action.type) {
        case actions.ADD_SKILL_MAP:
            return {
                ...state,
                maps: {
                    ...state.maps,
                    [action.map.mapId]: action.map
                }
            }
        case actions.CLEAR_SKILL_MAPS:
            return {
                ...state,
                maps: {}
            };
        case actions.CLEAR_METADATA:
            return {
                ...state,
                title: initialState.title,
                description: initialState.description,
                infoUrl: initialState.infoUrl,
                backgroundImageUrl: undefined,
                pixellatedBackground: undefined,
                bannerImageUrl: undefined,
                alternateSourceUrls: undefined,
                theme: {
                    ...initialState.theme
                }
            };
        case actions.CHANGE_SELECTED_ITEM:
            return {
                ...state,
                selectedItem: {
                    mapId: action.mapId,
                    activityId: action.activityId
                }
            };
        case actions.SET_SKILL_MAP_COMPLETED:
            return {
                ...state,
                user: {
                    ...state.user,
                    mapProgress: {
                        ...state.user.mapProgress,
                        [state.pageSourceUrl] : {
                            ...state.user.mapProgress?.[state.pageSourceUrl],
                            [action.mapId]: {
                                ...state.user.mapProgress?.[state.pageSourceUrl]?.[action.mapId],
                                completionState: "completed"
                            }
                        }
                    }
                }
            }
        case actions.OPEN_ACTIVITY:
            return {
                ...state,
                editorView: {
                    currentMapId: action.mapId,
                    currentActivityId: action.activityId,
                    state: "active",
                    allowCodeCarryover: !!action.carryoverCode,
                    previousHeaderId: action.previousHeaderId,
                    currentHeaderId: lookupActivityProgress(
                        state.user,
                        state.pageSourceUrl,
                        action.mapId,
                        action.activityId,
                    )?.headerId

                }
            };
        case actions.SAVE_AND_CLOSE_ACTIVITY:
            return {
                ...state,
                editorView: {
                    ...state.editorView!,
                    state: "saving"
                }
            };
        case actions.CLOSE_ACTIVITY:
            const currentMap = state.maps[state.editorView!.currentMapId];
            const currentActivityId = state.editorView!.currentActivityId;

            // When a node is completed, we mark any following reward nodes as complete also
            const finishedNodes = action.finished ? getFinishedNodes(currentMap, currentActivityId) : [];
            const selectedItem = finishedNodes.find(el => isRewardNode(el));
            const existing = selectedItem && state.user.mapProgress[state.pageSourceUrl]?.[currentMap.mapId]?.activityState[selectedItem.activityId];

            return {
                ...state,
                selectedItem: selectedItem && !existing ? {
                    mapId: currentMap.mapId,
                    activityId: selectedItem.activityId
                } : state.selectedItem,
                editorView: undefined,
                user: action.finished ?
                    setActivityFinished(state.user, state.pageSourceUrl, currentMap, finishedNodes.map(n => n.activityId)) :
                    state.user
            };
        case actions.RESTART_ACTIVITY:
            return {
                ...state,
                modalQueue: [],
                editorView: {
                    state: "active",
                    currentMapId: action.mapId,
                    currentActivityId: action.activityId,
                    allowCodeCarryover: !!action.carryoverCode,
                    previousHeaderId: action.previousHeaderId
                },
                user: setHeaderIdForActivity(
                    state.user,
                    state.pageSourceUrl,
                    state.maps[action.mapId],
                    action.activityId
                )
            }
        case actions.SET_HEADERID_FOR_ACTIVITY:
            const isCurrentActivity = state.editorView?.currentActivityId === action.activityId && state.editorView?.currentMapId === action.mapId;
            return {
                ...state,
                editorView: isCurrentActivity ? {
                    ...state.editorView!,
                    currentHeaderId: action.id
                } : state.editorView,
                user: setHeaderIdForActivity(
                    state.user,
                    state.pageSourceUrl,
                    state.maps[action.mapId],
                    action.activityId,
                    action.id,
                    action.currentStep,
                    action.maxSteps,
                    action.isCompleted
                )
            };
        case actions.SET_USER:
            const pageSourceUrl = state.pageSourceUrl;

            // Apply data structure upgrades
            let user = applyUserUpgrades(action.user, pxt.skillmap.USER_VERSION, pageSourceUrl, state.maps);

            // Migrate user projects from alternate pageSourceUrls, if provided
            if (state.alternateSourceUrls) {
                user = applyUserMigrations(user, pageSourceUrl, state.alternateSourceUrls)
            }

            // Fill in empty objects for remaining maps
            if (!user.mapProgress[pageSourceUrl]) user.mapProgress[pageSourceUrl] = {};
            Object.keys(state.maps).forEach(mapId => {
                if (!user.mapProgress[pageSourceUrl][mapId]) {
                    user.mapProgress[pageSourceUrl][mapId] = { completionState: "incomplete", mapId, activityState: { } };
                }
            })

            return {
                ...state,
                user
            };
        case actions.RESET_USER:
            pxt.storage.removeLocal(state.pageSourceUrl +  cloudLocalStoreKey)

            return {
                ...state,
                user: {
                    ...state.user,
                    completedTags: {
                        ...state.user.completedTags,
                        [state.pageSourceUrl]: {}
                    },
                    mapProgress: {
                        ...state.user.mapProgress,
                        [state.pageSourceUrl]: {}
                    }
                }
            };
        case actions.UPDATE_USER_COMPLETED_TAGS:
            if (!state.pageSourceUrl) return state;
            return {
                ...state,
                user: {
                    ...state.user,
                    completedTags: {
                        ...state.user.completedTags,
                        [state.pageSourceUrl]: getCompletedTags(state.user, state.pageSourceUrl, Object.keys(state.maps).map(key => state.maps[key]))
                    }
                }
            }
        case actions.SET_SHARE_STATUS:
            return {
                ...state,
                shareState: action.headerId || action.url ? {
                    headerId: action.headerId,
                    projectName: action.projectName,
                    data: action.data,
                    rewardsShare: state.shareState?.rewardsShare
                } : undefined
            }
        case actions.SET_CLOUD_STATUS:
            return {
                ...state,
                cloudState: {
                    ...state.cloudState,
                    [action.headerId]: action.status
                }
            }
        case actions.SET_PAGE_TITLE:
            return {
                ...state,
                title: action.title
            }
        case actions.SET_PAGE_DESCRIPTION:
            return {
                ...state,
                description: action.description
            }
        case actions.SET_PAGE_INFO_URL:
            return {
                ...state,
                infoUrl: action.infoUrl
            }
        case actions.SET_PAGE_BACKGROUND_IMAGE_URL:
            return {
                ...state,
                backgroundImageUrl: action.backgroundImageUrl,
                pixellatedBackground: action.pixellatedBackground
            }
        case actions.SET_PAGE_BANNER_IMAGE_URL:
            return {
                ...state,
                bannerImageUrl: action.bannerImageUrl
            }
        case actions.SET_PAGE_THEME:
            return {
                ...state,
                theme: action.theme
            }
        case actions.SET_PAGE_SOURCE_URL:
            return {
                ...state,
                pageSourceUrl: action.url,
                pageSourceStatus: action.status
            }
        case actions.SET_PAGE_ALTERNATE_URLS:
            return {
                ...state,
                alternateSourceUrls: action.urls
            }
        case actions.SET_MODAL:
            return {
                ...state,
                shareState: action.rewardsShare !== undefined ? {
                    headerId: state.shareState?.headerId || "",
                    projectName: state.shareState?.projectName || "",
                    data: state.shareState?.data,
                    rewardsShare: action.rewardsShare
                } : state.shareState,
                modalQueue: [action.modal]
            }
        case actions.ENQUEUE_MODALS:
            return {
                ...state,
                modalQueue: action.modals
            };
        case actions.NEXT_MODAL:
            return {
                ...state,
                modalQueue: state.modalQueue?.slice(1)
            };
        case actions.HIDE_MODAL:
            return {
                ...state,
                modalQueue: []
            };
        case actions.SHOW_COMPLETION_MODAL:
            return {
                ...state,
                modalQueue: getCompletionModals(state.maps[action.mapId], action.activityId)
            }
        case actions.SHOW_USER_PROFILE:
            return {
                ...state,
                showProfile: true
            };
        case actions.HIDE_USER_PROFILE:
            return {
                ...state,
                showProfile: false
            };
        case actions.SET_USER_PROFILE:
            return {
                ...state,
                auth: {
                    ...state.auth,
                    profile: action.profile,
                    signedIn: !!action.profile?.id
                }
            };
        case actions.SHOW_SELECT_LANGUAGE:
            return {
                ...state,
                showSelectLanguage: true
            };
        case actions.HIDE_SELECT_LANGUAGE: {
            return {
                ...state,
                showSelectLanguage: false
            }
        }
        case actions.SHOW_SELECT_THEME:
            return {
                ...state,
                showSelectTheme: true
            };
        case actions.HIDE_SELECT_THEME:
            return {
                ...state,
                showSelectTheme: false
            };
        case actions.SET_USER_PREFERENCES:
            return {
                ...state,
                auth: {
                    ...state.auth,
                    preferences: action.preferences,
                }
            };
        case actions.USER_LOG_OUT:
            return {
                ...state,
                auth: {
                    ...state.auth,
                    signedIn: false
                }
            }
        case actions.SET_READY_RESOURCES:
            return {
                ...state,
                readyResources: action.resources
            }
        case actions.GRANT_SKILLMAP_BADGE:
            return {
                ...state
            }
        case actions.SHOW_FEEDBACK:
            return {
                ...state,
                showFeedback: true
            }
        case actions.HIDE_FEEDBACK:
            return {
                ...state,
                showFeedback: false
            }
        default:
            return state
    }
}


export function setHeaderIdForActivity(user: UserState, pageSource: string, map: SkillMap, activityId: string, headerId?: string, currentStep?: number, maxSteps?: number, isCompleted = false): UserState {
    const mapId = map.mapId;
    let existing = lookupActivityProgress(user, pageSource, mapId, activityId);

    if (!existing) {
        existing = {
            isCompleted: false,
            activityId,
            currentStep,
            maxSteps,
            headerId
        }
    }

    const currentMapProgress = user.mapProgress?.[pageSource] || {};
    return {
        ...user,
        mapProgress: {
            ...user.mapProgress,
            [pageSource]: {
                ...currentMapProgress,
                [mapId]: {
                    ...(currentMapProgress?.[mapId] || { mapId }),
                    activityState: {
                        ...(currentMapProgress?.[mapId]?.activityState || {}),
                        [activityId]: {
                            ...existing,
                            headerId,
                            currentStep,
                            maxSteps,
                            isCompleted: existing.isCompleted || isCompleted
                        }
                    }
                }
            }
        }
    };
}

export function shouldAllowCodeCarryover(state: SkillMapState, mapId: string, activityId: string) {
    const map = state.maps[mapId];
    const activity = map.activities[activityId];
    return !!(activity?.kind === "activity" && activity.allowCodeCarryover);
}

export function setActivityFinished(user: UserState, pageSource: string, map: SkillMap, activityIds: string[]) {
    const mapId = map.mapId;

    let shouldTransition = false;
    const completedNodes: {[key: string]: ActivityState} = { } ;
    activityIds.forEach(el => {
        let activity = lookupActivityProgress(user, pageSource, mapId, el);
        // Only auto-transition the first time a completion node is reached
        shouldTransition = shouldTransition || (isRewardNode(map.activities[el]) && !activity?.isCompleted);
        completedNodes[el] = (activity || {
            isCompleted: true,
            activityId: el,
            headerId: "",
            currentStep: 0
        })
        completedNodes[el].isCompleted = true;
        completedNodes[el].completedTime = Date.now();
    })

    const currentMapProgress = user.mapProgress?.[pageSource] || {};
    return {
        ...user,
        mapProgress: {
            ...user.mapProgress,
            [pageSource]: {
                ...currentMapProgress,
                [mapId]: {
                    ...(currentMapProgress?.[mapId] || { mapId }),
                    activityState: {
                        ...(currentMapProgress?.[mapId]?.activityState || {}),
                        ...completedNodes
                    },
                    completionState: shouldTransition ? "transitioning" : currentMapProgress?.[mapId]?.completionState
                }
            }
        }
    };
}

function getFinishedNodes(map: SkillMap, activityId: string) {
    const node = map.activities[activityId]
    const completedNodes: MapNode[] = [node];

    // Reward and completion nodes are automatically marked finished
    const autoComplete = map.activities[activityId].next.filter(el => isRewardNode(el));
    return completedNodes.concat(autoComplete);
}

function getCompletionModals(map: SkillMap, activityId: string) {
    const result: ModalState[] = [
        {
            type: "completion",
            currentMapId: map.mapId,
            currentActivityId: activityId,
        }
    ];

    const activity = map.activities[activityId] as MapRewardNode;

    // If we only have a certificate, don't bother showing multiple reward modals. This is mostly legacy for
    // old skillmaps
    if (activity.rewards.length === 1 && activity.rewards[0].type === "certificate") {
        result[0].currentReward = activity.rewards[0];
        return result;
    }

    for (const reward of activity.rewards) {
        result.push({
            type: "reward",
            currentMapId: map.mapId,
            currentActivityId: activityId,
            currentReward: reward
        })
    }

    return result;
}

export default topReducer;
