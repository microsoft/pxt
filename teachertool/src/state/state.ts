import { ConfirmationModalProps } from "../components/ConfirmationModal";
import { ModalType, ToastWithId, TabName } from "../types";
import { CatalogCriteria, CriteriaEvaluationResult, CriteriaInstance } from "../types/criteria";
import { Rubric } from "../types/rubric";
import { makeRubric } from "../utils";

export type AppState = {
    targetConfig?: pxt.TargetConfig;
    toasts: ToastWithId[];
    evalResults: pxt.Map<CriteriaEvaluationResult>; // Criteria Instance Id -> Result
    projectMetadata: pxt.Cloud.JsonScript | undefined;
    catalog: CatalogCriteria[] | undefined;
    rubric: Rubric;
    modal: ModalType | undefined;
    activeTab: TabName;
    validatorPlans: pxt.blocks.ValidatorPlan[] | undefined;
    autorun: boolean;
    confirmationProps: ConfirmationModalProps | undefined;
    flags: {
        testCatalog: boolean;
    };
};

export const initialAppState: AppState = {
    toasts: [],
    evalResults: {},
    projectMetadata: undefined,
    catalog: undefined,
    rubric: makeRubric(),
    modal: undefined,
    activeTab: "home",
    validatorPlans: undefined,
    autorun: false,
    confirmationProps: undefined,
    flags: {
        testCatalog: false,
    },
};
