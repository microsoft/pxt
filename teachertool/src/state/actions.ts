import { ModalType, NotificationWithId } from "../types";

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
    result: pxt.blocks.EvaluationResult | undefined;
};

type SetCatalog = ActionBase & {
    type: "SET_CATALOG";
    catalog: pxt.blocks.CatalogCriteria[] | undefined;
};

type AddCriteriaInstance = ActionBase & {
    type: "ADD_CRITERIA_INSTANCE"
    criteria: pxt.blocks.CriteriaInstance;
};

type RemoveCriteriaInstance = ActionBase & {
    type: "REMOVE_CRITERIA_INSTANCE";
    instanceId: string;
};

type ShowModal = ActionBase & {
    type: "SHOW_MODAL";
    modal: ModalType;
};

type HideModal = ActionBase & {
    type: "HIDE_MODAL";
};

/**
 * Union of all actions
 */

export type Action =
    | PostNotification
    | RemoveNotification
    | SetProjectMetadata
    | SetEvalResult
    | SetCatalog
    | AddCriteriaInstance
    | RemoveCriteriaInstance
    | ShowModal
    | HideModal;

/**
 * Action creators
 */
const postNotification = (
    notification: NotificationWithId
): PostNotification => ({
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

const setEvalResult = (result: pxt.blocks.EvaluationResult | undefined): SetEvalResult => ({
    type: "SET_EVAL_RESULT",
    result,
});

const setCatalog = (catalog: pxt.blocks.CatalogCriteria[] | undefined): SetCatalog => ({
    type: "SET_CATALOG",
    catalog,
});

const addCriteriaInstance = (criteria: pxt.blocks.CriteriaInstance): AddCriteriaInstance => ({
    type: "ADD_CRITERIA_INSTANCE",
    criteria,
});

const removeCriteriaInstance = (instanceId: string): RemoveCriteriaInstance => ({
    type: "REMOVE_CRITERIA_INSTANCE",
    instanceId,
});

const showModal = (modal: ModalType): ShowModal => ({
    type: "SHOW_MODAL",
    modal,
});

const hideModal = (): HideModal => ({
    type: "HIDE_MODAL",
});

export {
    postNotification,
    removeNotification,
    setProjectMetadata,
    setEvalResult,
    setCatalog,
    addCriteriaInstance,
    removeCriteriaInstance,
    showModal,
    hideModal
};
