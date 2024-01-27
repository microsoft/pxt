// A criteria defined in the catalog of all possible criteria for the user to choose from when creating a rubric.
export interface CatalogCriteria {
    id: string; // A unique id (GUID) for the catalog criteria
    use: string; // Refers to the validator plan this criteria relies upon
    template: string; // A (mostly) human-readable string describing the criteria. May contain parameters
    description: string | undefined; // More detailed description
    docPath: string | undefined; // Path to documentation
    parameters: CriteriaParameter[] | undefined; // Any parameters that affect the criteria
}

// An instance of a criteria in a rubric.
export interface CriteriaInstance {
    catalogCriteriaId: string;
    instanceId: string;
    params: CriteriaParameterValue[] | undefined;
}

// Represents a parameter definition in a catalog criteria.
export interface CriteriaParameter {
    name: string;
    type: string;
    path: string; // The json path of the parameter in the catalog criteria.
}

// Represents a parameter value in a criteria instance.
export interface CriteriaParameterValue {
    name: string;
    value: any; // Undefined if no value has been selected.
}

// Possible results from evaluating a criteria instance.
export enum CriteriaEvaluationResult {
    Pass,
    Fail,
    CompleteWithNoResult,
    InProgress,
}