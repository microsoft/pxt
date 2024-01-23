import { ModalType, Notifications } from "../types";

export type AppState = {
    targetConfig?: pxt.TargetConfig;
    notifications: Notifications;
    currentEvalResult: pxt.blocks.EvaluationResult | undefined;
    projectMetadata: pxt.Cloud.JsonScript | undefined;
    catalog: pxt.blocks.CatalogCriteria[] | undefined;
    selectedCriteria: pxt.blocks.CriteriaInstance[];
    modal: ModalType | undefined;
};

export const initialAppState: AppState = {
    notifications: [],
    currentEvalResult: undefined,
    projectMetadata: undefined,
    catalog: undefined,
    selectedCriteria: [],
    modal: undefined
};
