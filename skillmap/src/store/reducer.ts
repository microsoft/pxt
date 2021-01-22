import * as actions from '../actions/types'
import { guidGen } from '../lib/browserUtils';
import { getCompletedTags, lookupActivityProgress, isMapCompleted, applyUserUpgrades } from '../lib/skillMapUtils';

export type ModalType = "restart-warning" | "completion" | "report-abuse" | "reset";
export type PageSourceStatus = "approved" | "banned" | "unknown";

// State for the entire page
export interface SkillMapState {
    title: string;
    description: string;
    infoUrl?: string;
    user: UserState;
    pageSourceUrl: string;
    pageSourceStatus: PageSourceStatus;
    maps: { [key: string]: SkillMap };
    selectedItem?: string;

    editorView?: EditorViewState;
    modal?: ModalState;
}

export interface EditorViewState {
    currentHeaderId?: string;
    currentMapId: string;
    currentActivityId: string;
    state: "active" | "saving";
}

interface ModalState {
    type: ModalType;
    currentMapId?: string;
    currentActivityId?: string;
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
    maps: {}
}

const topReducer = (state: SkillMapState = initialState, action: any): SkillMapState => {
    switch (action.type) {
        case actions.ADD_SKILL_MAP:
            return {
                ...state,
                user: {
                    ...state.user,
                    mapProgress: {
                        ...state.user.mapProgress,
                        [state.pageSourceUrl] : {
                            ...state.user.mapProgress?.[state.pageSourceUrl],
                            [action.map.mapId]: { completionState: "incomplete", mapId: action.map.mapId, activityState: { } }
                        }
                    }
                },
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
        case actions.CHANGE_SELECTED_ITEM:
            return {
                ...state,
                selectedItem: action.id
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
            return {
                ...state,
                editorView: undefined,
                user: action.finished ?
                    setActivityFinished(state.user, state.pageSourceUrl, state.maps[state.editorView!.currentMapId], state.editorView!.currentActivityId) :
                    state.user
            };
        case actions.RESTART_ACTIVITY:
            return {
                ...state,
                modal: undefined,
                editorView: {
                    state: "active",
                    currentMapId: action.mapId,
                    currentActivityId: action.activityId
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
                    action.maxSteps
                )
            };
        case actions.SET_USER:
            return {
                ...state,
                user: applyUserUpgrades(action.user, pxt.skillmap.USER_VERSION, state.pageSourceUrl, state.maps)
            };
        case actions.RESET_USER:
            return {
                ...state,
                user: {
                    ...state.user,
                    completedTags: {},
                    mapProgress: {}
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
        case actions.SET_PAGE_SOURCE_URL:
            return {
                ...state,
                pageSourceUrl: action.url,
                pageSourceStatus: action.status
            }
        case actions.SHOW_COMPLETION_MODAL:
            return {
                ...state,
                modal: { type: "completion", currentMapId: action.mapId, currentActivityId: action.activityId }
            };
        case actions.SHOW_RESTART_ACTIVITY_MODAL:
            return {
                ...state,
                modal: { type: "restart-warning", currentMapId: action.mapId, currentActivityId: action.activityId }
            };
        case actions.SHOW_REPORT_ABUSE_MODAL:
            return {
                ...state,
                modal: { type: "report-abuse", currentMapId: action.mapId, currentActivityId: action.activityId }
            };
        case actions.SHOW_RESET_USER_MODAL:
            return {
                ...state,
                modal: { type: "reset" }
            };
        case actions.HIDE_MODAL:
            return {
                ...state,
                modal: undefined
            };
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

    // Only transition the first time a carousel/skill path is completed: we check that the map is completed
    // (not including the current activity), that the current activity is not YET completed, but about to be
    const shouldTransition = isMapCompleted(user, pageSource, map, activityId) && !existing.isCompleted && isCompleted;
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
                    },
                    completionState: shouldTransition ? "transitioning" : currentMapProgress?.[mapId]?.completionState
                }
            }
        }
    };
}

export function setActivityFinished(user: UserState, pageSource: string, map: SkillMap, activityId: string) {
    const mapId = map.mapId;
    let existing = lookupActivityProgress(user, pageSource, mapId, activityId);

    if (!existing) {
        existing = {
            isCompleted: false,
            activityId,
            headerId: "",
            currentStep: 0
        }
    }

    // Only transition the first time a carousel/skill path is completed: we check that the map is completed
    // (not including the current activity) and that the current activity is not yet completed
    const shouldTransition = isMapCompleted(user, pageSource, map, activityId) && !existing.isCompleted;
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
                            isCompleted: true
                        }
                    },
                    completionState: shouldTransition ? "transitioning" : currentMapProgress?.[mapId]?.completionState
                }
            }
        }
    };
}

export default topReducer;