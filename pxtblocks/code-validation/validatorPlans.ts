namespace pxt.blocks {
    // A set of validation checks (with inputs) to run for a given criteria.
    export interface ValidatorPlan {
        name: string;
        threshold: number;
        checks: ValidatorCheckBase[];
    }

    // Used so a specific plan can be identified when sending results.
    export interface ValidatorPlanWithId extends ValidatorPlan {
        id: string;
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

    function isBlocksExistValidatorCheck(check: ValidatorCheckBase): check is BlocksExistValidatorCheck {
        return check.validator === "blocksExist";
    }

    // export function getValidatorCheck(check: ValidatorCheckBase): ValidatorCheckBase {
    //     switch (check.validator) {
    //         case "blocksExist":
    //             return ;
    //         default:
    //             console.error(`Unrecognized validator: ${check.validator}`);
    //             return undefined;
    //     }
    // }

    // export function parseValidatorPlans(plans: string): ValidatorPlan[] {
    //     let plansObj;
    //     try {
    //         plansObj = JSON.parse(plans);
    //     } catch (e) {
    //         console.error(`Error parsing validator plans. ${e}`);
    //         return undefined;
    //     }

    //     const finalPlans = plansObj.map(plan => {
    //         const checks: ValidatorCheckBase[] = plan.checks.map((c: ValidatorCheckBase) => {
    //             return getValidatorCheck(c);
    //         }).filter((r: ValidatorCheckBase) => !!r);

    //         return {
    //             name: plan.name,
    //             threshold: plan.threshold,
    //             checks: checks
    //         } as ValidatorPlan;
    //     });

    //     return finalPlans;
    // }
}