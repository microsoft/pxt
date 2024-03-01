/// <reference path="./pxtpackage.d.ts" />

declare namespace pxt.blocks {
    // A set of validation checks (with inputs) to run for a given criteria.
    export interface ValidatorPlan {
        name: string;
        threshold: number;
        checks: ValidatorCheckBase[];
    }

    // Base class to describes a single validation check to run (with inputs).
    // Each type of validation will need to implement its own ValidatorCheck based on this.
    export interface ValidatorCheckBase {
        validator: string;
        childValidatorPlans?: string[]
    }

    // Inputs for "Blocks Exist" validation.
    export interface BlocksExistValidatorCheck extends ValidatorCheckBase {
        validator: "blocksExist";
        blockCounts: pxt.Map<number>;
    }

    export interface BlockCommentsExistValidatorCheck extends ValidatorCheckBase {
        validator: "blockCommentsExist";
        count: number;
    }
    export interface SpecificBlockCommentsExistValidatorCheck extends ValidatorCheckBase {
        validator: "specificBlockCommentsExist";
        blockType: string;
    }

    export interface BlocksInSetExistValidatorCheck extends ValidatorCheckBase {
        validator: "blocksInSetExist";
        blocks: string[];
        count: number;
    }

    export interface AiQuestionValidatorCheck extends ValidatorCheckBase {
        validator: "aiQuestion";
        question: string;
    }

    export interface EvaluationResult {
        result: boolean;
    }
}
