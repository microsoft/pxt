import { ModalType, Notifications } from "../types";
import { CatalogCriteria, CriteriaInstance } from "../types/criteria";

export type AppState = {
    targetConfig?: pxt.TargetConfig;
    notifications: Notifications;
    currentEvalResult: pxt.blocks.EvaluationResult | undefined;
    projectMetadata: pxt.Cloud.JsonScript | undefined;
    catalog: CatalogCriteria[] | undefined;
    selectedCriteria: CriteriaInstance[];
    modal: ModalType | undefined;
    validatorPlans: pxt.blocks.ValidatorPlan[] | undefined;
    flags: {
        testCatalog: boolean;
    }
};

export const initialAppState: AppState = {
    notifications: [],
    currentEvalResult: undefined,
    projectMetadata: undefined,
    catalog: undefined,
    selectedCriteria: [],
    modal: undefined,
    validatorPlans: undefined,
    flags: {
        testCatalog: false
    }
};
