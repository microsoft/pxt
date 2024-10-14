export type CriteriaParameterType = "string" | "longString" | "number" | "block" | "system";

// Represents a parameter definition in a catalog criteria.
export type CriteriaParameterBase = {
    name: string;
    type: CriteriaParameterType;
    default: string | undefined;
    paths: string[]; // The json path(s) to update with the parameter value in the catalog criteria.
};

export type StringParameterBase = CriteriaParameterBase & {
    maxCharacters?: number;
};

export type StringParameter = StringParameterBase & {
    type: "string";
};

export type LongStringParameter = StringParameterBase & {
    type: "longString";
};

export type NumberParameter = CriteriaParameterBase & {
    type: "number";
    min?: number;
    max?: number;
};

export type BlockParameter = CriteriaParameterBase & {
    type: "block";
};

/**
 * System parameters are fields that can change for a criteria but which are not set directly by the user.
 * For example, the project id could be a parameter, but we fill it automatically at eval-time based on the loaded project.
 */
export type SystemParameter = CriteriaParameterBase & {
    type: "system";
    key?: string;
};

export type CriteriaParameter =
    | StringParameter
    | LongStringParameter
    | NumberParameter
    | BlockParameter
    | SystemParameter;

export interface CriteriaParameterValidationResult {
    valid: boolean;
    message?: string;
}
