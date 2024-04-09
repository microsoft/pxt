import { ToastWithId, TabName, ProjectData } from "../types";
import { CatalogCriteria, CriteriaResult } from "../types/criteria";
import { ModalOptions } from "../types/modalOptions";
import { Rubric } from "../types/rubric";
import { makeRubric } from "../utils";

export type AppState = {
    targetConfig?: pxt.TargetConfig;
    toasts: ToastWithId[];
    evalResults: pxt.Map<CriteriaResult>; // Criteria Instance Id -> Result
    projectMetadata: ProjectData | undefined;
    catalog: CatalogCriteria[] | undefined;
    rubric: Rubric;
    activeTab: TabName;
    validatorPlans: pxt.blocks.ValidatorPlan[] | undefined;
    autorun: boolean;
    modalOptions: ModalOptions | undefined;
    toolboxCategories?: pxt.Map<pxt.editor.ToolboxCategoryDefinition>;
    blockImageCache: pxt.Map<string>; // block id -> image uri
    copilotEndpointOverride?: string; // TODO: remove once copilot is available in prod.
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
    activeTab: "home",
    validatorPlans: undefined,
    autorun: false,
    modalOptions: undefined,
    toolboxCategories: undefined,
    blockImageCache: {},
    copilotEndpointOverride: undefined,
    flags: {
        testCatalog: false,
    },
};
