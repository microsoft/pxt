import { NotificationWithId } from "../types";

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

/**
 * Union of all actions
 */

export type Action =
    | PostNotification
    | RemoveNotification
    | SetProjectMetadata
    | SetEvalResult;

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

const setProjectMetadata = (meta: pxt.Cloud.JsonScript | undefined): SetProjectMetadata => ({
    type: "SET_PROJECT_METADATA",
    metadata: meta,
});

const setEvalResult = (result: pxt.blocks.EvaluationResult | undefined): SetEvalResult => ({
    type: "SET_EVAL_RESULT",
    result,
});

export {
    postNotification,
    removeNotification,
    setProjectMetadata,
    setEvalResult,
};
