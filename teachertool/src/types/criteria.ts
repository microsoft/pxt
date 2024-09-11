import { UserFeedback } from ".";
import { CriteriaParameter } from "./criteriaParameters";

// A criteria defined in the catalog of all possible criteria for the user to choose from when creating a checklist.
export interface CatalogCriteria {
    id: string; // A unique id (GUID) for the catalog criteria
    use: string; // Refers to the validator plan this criteria relies upon
    template: string; // A (mostly) human-readable string describing the criteria. May contain parameters
    description: string | undefined; // More detailed description
    docPath: string | undefined; // Path to documentation
    params: CriteriaParameter[] | undefined; // Any parameters that affect the criteria
    hideInCatalog?: boolean; // Whether the criteria should be hidden in the user-facing catalog
    maxCount?: number; // The maximum number of instances allowed for this criteria within a single checklist. Unlimited if undefined.
    tags?: string[]; // Tags to help categorize the criteria
    requestFeedback?: boolean; // Whether the criteria should request feedback from the user
}

// An instance of a criteria in a checklist.
export interface CriteriaInstance {
    catalogCriteriaId: string;
    instanceId: string;
    params: CriteriaParameterValue[] | undefined;
    userFeedback?: UserFeedback;
}

// Represents a parameter value in a criteria instance.
export interface CriteriaParameterValue {
    name: string;
    value: any; // Undefined if no value has been selected.
}

// Possible results from evaluating a criteria instance.
export enum EvaluationStatus {
    Pass,
    Fail,
    CompleteWithNoResult,
    InProgress,
    NotStarted,
}

export interface CriteriaResult {
    result: EvaluationStatus;
    notes?: string;
    error?: string;
}
