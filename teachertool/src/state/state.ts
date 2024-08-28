import { ToastWithId, TabName, ProjectData } from "../types";
import { CatalogCriteria, CriteriaResult } from "../types/criteria";
import { ModalOptions } from "../types/modalOptions";
import { Checklist } from "../types/checklist";
import { makeChecklist as makeChecklist } from "../utils";

export type AppState = {
    targetConfig?: pxt.TargetConfig;
    toasts: ToastWithId[];
    evalResults: pxt.Map<CriteriaResult>; // Criteria Instance Id -> Result
    projectMetadata: ProjectData | undefined;
    catalog: CatalogCriteria[] | undefined;
    checklist: Checklist;
    activeTab: TabName;
    validatorPlans: pxt.blocks.ValidatorPlan[] | undefined;
    autorun: boolean;
    modalOptions: ModalOptions | undefined;
    toolboxCategories?: pxt.Map<pxt.editor.ToolboxCategoryDefinition>;
    blockImageCache: pxt.Map<string>; // block id -> image uri
    catalogOpen: boolean;
    screenReaderAnnouncement?: string;
    userProfile: pxt.auth.UserProfile | undefined;
    flags: {
        testCatalog: boolean;
    };
};

export const initialAppState: AppState = {
    toasts: [],
    evalResults: {},
    projectMetadata: undefined,
    catalog: undefined,
    checklist: makeChecklist(),
    activeTab: "home",
    validatorPlans: undefined,
    autorun: false,
    modalOptions: undefined,
    toolboxCategories: undefined,
    blockImageCache: {},
    catalogOpen: false,
    screenReaderAnnouncement: undefined,
    userProfile: undefined,
    flags: {
        testCatalog: false,
    },
};
