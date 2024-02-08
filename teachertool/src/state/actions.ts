import { ModalType, NotificationWithId, TabName } from "../types";
import { CatalogCriteria, CriteriaEvaluationResult } from "../types/criteria";
import { Rubric } from "../types/rubric";

// Changes to app state are performed by dispatching actions to the reducer
type ActionBase = {
    type: string;
};

/**
 * Actions
 */
type PostNotification = ActionBase & {
    type: "POST_NOTIFICATION";
    notification: NotificationWithId;
};

type RemoveNotification = ActionBase & {
    type: "REMOVE_NOTIFICATION";
    notificationId: string;
};

type SetProjectMetadata = ActionBase & {
    type: "SET_PROJECT_METADATA";
    metadata: pxt.Cloud.JsonScript | undefined;
};

type SetEvalResult = ActionBase & {
    type: "SET_EVAL_RESULT";
    criteriaInstanceId: string;
    result: CriteriaEvaluationResult;
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

type SetRubric = ActionBase & {
    type: "SET_RUBRIC";
    rubric: Rubric;
};

type ShowModal = ActionBase & {
    type: "SHOW_MODAL";
    modal: ModalType;
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

type SetAutorun = ActionBase & {
    type: "SET_AUTORUN";
    autorun: boolean;
};

/**
 * Union of all actions
 */

export type Action =
    | PostNotification
    | RemoveNotification
    | SetProjectMetadata
    | SetEvalResult
    | ClearEvalResult
    | ClearAllEvalResults
    | SetTargetConfig
    | SetCatalog
    | SetRubric
    | ShowModal
    | HideModal
    | SetValidatorPlans
    | SetActiveTab
    | SetAutorun;

/**
 * Action creators
 */
const postNotification = (notification: NotificationWithId): PostNotification => ({
    type: "POST_NOTIFICATION",
    notification,
});

const removeNotification = (notificationId: string): RemoveNotification => ({
    type: "REMOVE_NOTIFICATION",
    notificationId,
});

const setProjectMetadata = (metadata: pxt.Cloud.JsonScript | undefined): SetProjectMetadata => ({
    type: "SET_PROJECT_METADATA",
    metadata,
});

const setEvalResult = (criteriaInstanceId: string, result: CriteriaEvaluationResult): SetEvalResult => ({
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

const setRubric = (rubric: Rubric): SetRubric => ({
    type: "SET_RUBRIC",
    rubric,
});

const showModal = (modal: ModalType): ShowModal => ({
    type: "SHOW_MODAL",
    modal,
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

const setAutorun = (autorun: boolean): SetAutorun => ({
    type: "SET_AUTORUN",
    autorun,
});

export {
    postNotification,
    removeNotification,
    setProjectMetadata,
    setEvalResult,
    clearEvalResult,
    clearAllEvalResults,
    setTargetConfig,
    setCatalog,
    setRubric,
    showModal,
    hideModal,
    setValidatorPlans,
    setActiveTab,
    setAutorun,
};
