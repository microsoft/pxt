import { ToastWithId, TabName, ProjectData, UserFeedback } from "../types";
import { CatalogCriteria, CriteriaResult } from "../types/criteria";
import { ModalOptions } from "../types/modalOptions";
import { Checklist } from "../types/checklist";

// Changes to app state are performed by dispatching actions to the reducer
type ActionBase = {
    type: string;
};

/**
 * Actions
 */
type ShowToast = ActionBase & {
    type: "SHOW_TOAST";
    toast: ToastWithId;
};

type DismissToast = ActionBase & {
    type: "DISMISS_TOAST";
    toastId: string;
};

type SetProjectMetadata = ActionBase & {
    type: "SET_PROJECT_METADATA";
    metadata: ProjectData | undefined;
    force?: boolean; // Optional flag to force reload even if metadata is the same
};

type SetEvalResult = ActionBase & {
    type: "SET_EVAL_RESULT";
    criteriaInstanceId: string;
    result: CriteriaResult;
};

type ClearEvalResult = ActionBase & {
    type: "CLEAR_EVAL_RESULT";
    criteriaInstanceId: string;
};

type ClearAllEvalResults = ActionBase & {
    type: "CLEAR_ALL_EVAL_RESULTS";
};

type SetTargetConfig = ActionBase & {
    type: "SET_TARGET_CONFIG";
    config: pxt.TargetConfig;
};

type SetCatalog = ActionBase & {
    type: "SET_CATALOG";
    catalog: CatalogCriteria[] | undefined;
};

type SetCatalogOpen = ActionBase & {
    type: "SET_CATALOG_OPEN";
    open: boolean;
};

type SetAskAiOpen = ActionBase & {
    type: "SET_ASK_AI_OPEN";
    open: boolean;
};

type SetChecklist = ActionBase & {
    type: "SET_CHECKLIST";
    checklist: Checklist;
};

type ShowModal = ActionBase & {
    type: "SHOW_MODAL";
    modalOptions: ModalOptions;
};

type HideModal = ActionBase & {
    type: "HIDE_MODAL";
};

type SetValidatorPlans = ActionBase & {
    type: "SET_VALIDATOR_PLANS";
    plans: pxt.blocks.ValidatorPlan[] | undefined;
};

type SetActiveTab = ActionBase & {
    type: "SET_ACTIVE_TAB";
    tabName: TabName;
};

type SetRunOnLoad = ActionBase & {
    type: "SET_RUN_ON_LOAD";
    runOnLoad: boolean;
};

type SetEvalResultsBatch = ActionBase & {
    type: "SET_EVAL_RESULTS_BATCH";
    criteriaResults: pxt.Map<CriteriaResult>;
};

type ClearAllEvalResultNotes = ActionBase & {
    type: "CLEAR_ALL_EVAL_RESULT_NOTES";
};

type SetToolboxCategories = ActionBase & {
    type: "SET_TOOLBOX_CATEGORIES";
    categories: pxt.Map<pxt.editor.ToolboxCategoryDefinition>;
};

type SetBlockImageUri = ActionBase & {
    type: "SET_BLOCK_IMAGE_URI";
    blockId: string;
    imageUri: string;
};

type SetScreenReaderAnnouncement = ActionBase & {
    type: "SET_SCREEN_READER_ANNOUNCEMENT";
    announcement: string;
};

type SetUserProfile = ActionBase & {
    type: "SET_USER_PROFILE";
    profile: pxt.auth.UserProfile | undefined;
};

type SetUserFeedback = ActionBase & {
    type: "SET_USER_FEEDBACK";
    criteriaInstanceId: string;
    userFeedback: UserFeedback;
};

/**
 * Union of all actions
 */

export type Action =
    | ShowToast
    | DismissToast
    | SetProjectMetadata
    | SetEvalResult
    | ClearEvalResult
    | ClearAllEvalResults
    | ClearAllEvalResultNotes
    | SetEvalResultsBatch
    | SetTargetConfig
    | SetCatalog
    | SetCatalogOpen
    | SetAskAiOpen
    | SetChecklist
    | ShowModal
    | HideModal
    | SetValidatorPlans
    | SetActiveTab
    | SetRunOnLoad
    | SetToolboxCategories
    | SetBlockImageUri
    | SetScreenReaderAnnouncement
    | SetUserProfile
    | SetUserFeedback;

/**
 * Action creators
 */
const showToast = (toast: ToastWithId): ShowToast => ({
    type: "SHOW_TOAST",
    toast,
});

const dismissToast = (toastId: string): DismissToast => ({
    type: "DISMISS_TOAST",
    toastId,
});

const setProjectMetadata = (metadata: ProjectData | undefined, force?: boolean): SetProjectMetadata => ({
    type: "SET_PROJECT_METADATA",
    metadata,
    force,
});

const setEvalResult = (criteriaInstanceId: string, result: CriteriaResult): SetEvalResult => ({
    type: "SET_EVAL_RESULT",
    criteriaInstanceId,
    result,
});

const clearEvalResult = (criteriaInstanceId: string): ClearEvalResult => ({
    type: "CLEAR_EVAL_RESULT",
    criteriaInstanceId,
});

const clearAllEvalResults = (): ClearAllEvalResults => ({
    type: "CLEAR_ALL_EVAL_RESULTS",
});

const setTargetConfig = (config: pxt.TargetConfig): SetTargetConfig => ({
    type: "SET_TARGET_CONFIG",
    config,
});

const setCatalog = (catalog: CatalogCriteria[] | undefined): SetCatalog => ({
    type: "SET_CATALOG",
    catalog,
});

const setCatalogOpen = (open: boolean): SetCatalogOpen => ({
    type: "SET_CATALOG_OPEN",
    open,
});

const setAskAiOpen = (open: boolean): SetAskAiOpen => ({
    type: "SET_ASK_AI_OPEN",
    open,
});

const setChecklist = (checklist: Checklist): SetChecklist => ({
    type: "SET_CHECKLIST",
    checklist,
});

const showModal = (modalOptions: ModalOptions): ShowModal => ({
    type: "SHOW_MODAL",
    modalOptions,
});

const hideModal = (): HideModal => ({
    type: "HIDE_MODAL",
});

const setValidatorPlans = (plans: pxt.blocks.ValidatorPlan[] | undefined): SetValidatorPlans => ({
    type: "SET_VALIDATOR_PLANS",
    plans,
});

const setActiveTab = (tabName: TabName): SetActiveTab => ({
    type: "SET_ACTIVE_TAB",
    tabName,
});

const setRunOnLoad = (runOnLoad: boolean): SetRunOnLoad => ({
    type: "SET_RUN_ON_LOAD",
    runOnLoad,
});

const setEvalResultsBatch = (criteriaResults: pxt.Map<CriteriaResult>): SetEvalResultsBatch => ({
    type: "SET_EVAL_RESULTS_BATCH",
    criteriaResults,
});

const clearAllEvalResultNotes = (): ClearAllEvalResultNotes => ({
    type: "CLEAR_ALL_EVAL_RESULT_NOTES",
});

const setToolboxCategories = (categories: pxt.Map<pxt.editor.ToolboxCategoryDefinition>): SetToolboxCategories => ({
    type: "SET_TOOLBOX_CATEGORIES",
    categories,
});

const setBlockImageUri = (blockId: string, imageUri: string): SetBlockImageUri => ({
    type: "SET_BLOCK_IMAGE_URI",
    blockId,
    imageUri,
});

const setScreenReaderAnnouncement = (announcement: string): SetScreenReaderAnnouncement => ({
    type: "SET_SCREEN_READER_ANNOUNCEMENT",
    announcement,
});

const setUserProfile = (profile: pxt.auth.UserProfile | undefined): SetUserProfile => ({
    type: "SET_USER_PROFILE",
    profile,
});

const setUserFeedback = (criteriaInstanceId: string, userFeedback: UserFeedback): SetUserFeedback => ({
    type: "SET_USER_FEEDBACK",
    criteriaInstanceId,
    userFeedback,
});

export {
    showToast,
    dismissToast,
    setProjectMetadata,
    setEvalResult,
    clearEvalResult,
    clearAllEvalResults,
    clearAllEvalResultNotes,
    setEvalResultsBatch,
    setTargetConfig,
    setCatalog,
    setCatalogOpen,
    setAskAiOpen,
    setChecklist,
    showModal,
    hideModal,
    setValidatorPlans,
    setActiveTab,
    setRunOnLoad,
    setToolboxCategories,
    setBlockImageUri,
    setScreenReaderAnnouncement,
    setUserProfile,
    setUserFeedback,
};
