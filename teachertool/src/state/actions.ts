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

type SetTargetConfig = ActionBase & {
    type: "SET_TARGET_CONFIG";
    config: pxt.TargetConfig;
};

/**
 * Union of all actions
 */

export type Action =
    | PostNotification
    | RemoveNotification
    | SetProjectMetadata
    | SetEvalResult
    | SetTargetConfig;

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

const setProjectMetadata = (
    metadata: pxt.Cloud.JsonScript | undefined
): SetProjectMetadata => ({
    type: "SET_PROJECT_METADATA",
    metadata,
});

const setEvalResult = (
    result: pxt.blocks.EvaluationResult | undefined
): SetEvalResult => ({
    type: "SET_EVAL_RESULT",
    result,
});

const setTargetConfig = (config: pxt.TargetConfig): SetTargetConfig => ({
    type: "SET_TARGET_CONFIG",
    config,
});

export {
    postNotification,
    removeNotification,
    setProjectMetadata,
    setEvalResult,
    setTargetConfig,
};
