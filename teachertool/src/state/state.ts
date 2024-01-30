import { ModalType, Notifications } from "../types";
import { CatalogCriteria, CriteriaEvaluationResult, CriteriaInstance } from "../types/criteria";

export type AppState = {
    targetConfig?: pxt.TargetConfig;
    notifications: Notifications;
    evalResults: pxt.Map<CriteriaEvaluationResult>; // Criteria Instance Id -> Result
    projectMetadata: pxt.Cloud.JsonScript | undefined;
    catalog: CatalogCriteria[] | undefined;
    selectedCriteria: CriteriaInstance[];
    modal: ModalType | undefined;
    validatorPlans: pxt.blocks.ValidatorPlan[] | undefined;
    flags: {
        testCatalog: boolean;
    };
};

export const initialAppState: AppState = {
    notifications: [],
    evalResults: {},
    projectMetadata: undefined,
    catalog: undefined,
    selectedCriteria: [],
    modal: undefined,
    validatorPlans: undefined,
    flags: {
        testCatalog: false,
    },
};
