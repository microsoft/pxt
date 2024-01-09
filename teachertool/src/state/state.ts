import { Notifications } from "../types";

export type AppState = {
    targetConfig?: pxt.TargetConfig;
    notifications: Notifications;
    currentEvalResult: pxt.blocks.EvaluationResult | undefined;
    projectMetadata: pxt.Cloud.JsonScript | undefined;
};

export const initialAppState: AppState = {
    notifications: [],
    currentEvalResult: undefined,
    projectMetadata: undefined,
};
