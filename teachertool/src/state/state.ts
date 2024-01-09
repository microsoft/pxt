import { Notifications } from "../types";

export type AppState = {
    targetConfig?: pxt.TargetConfig;
    notifications: Notifications;
    currentEvalResult: pxt.blocks.EvaluationResult | undefined;
};

export const initialAppState: AppState = {
    notifications: [],
    currentEvalResult: undefined,
};
