namespace pxt.blocks {
    export interface ValidatorCheck {
        validator: string;
    };

    export interface BlockExistsValidatorCheck extends ValidatorCheck {
        validator: "block_exists";
        inputs: {
            blockId: string;
            count: number;
        }[];
    }

    export interface AiQuestionValidatorCheck extends ValidatorCheck {
        validator: "ai_question";
    }

    export interface ValidatorPlan {
        name: string;
        threshold: number;
        checks: ValidatorCheck[];
    }

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

    // Possible values for CriteriaParameterPicker, these are different ways a user may enter parameter values.
    export type CriteriaParameterPicker = "blocksPicker" | "numericInput";

    // Represents a parameter definition in a catalog criteria.
    export interface CriteriaParameter {
        name: string;
        type: string;
        picker: CriteriaParameterPicker;
        path: string; // The json path of the parameter in the catalog criteria.
    }

    // Represents a parameter value in a criteria instance.
    export interface CriteriaParameterValue {
        name: string;
        value: any; // Undefined if no value has been selected.
    }
}
