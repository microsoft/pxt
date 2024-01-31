namespace pxt.blocks {
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
    }

    // Inputs for "Blocks Exist" validation.
    export interface BlocksExistValidatorCheck extends ValidatorCheckBase {
        validator: "blocksExist";
        blockCounts: pxt.Map<number>;
    }

    export interface BlockCommentExistsValidatorCheck extends ValidatorCheckBase {
        validator: "blockCommentExists";
        onBlocks?: pxt.Map<number>;
    }
}