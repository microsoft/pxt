import { logError } from "../services/loggingService";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";

const prodFiles = [
    "/teachertool/validator-plans.json", // target-specific catalog
    "/teachertool/validator-plans-shared.json" // shared across all targets
];

// Catalog entries still being tested, will only appear when in debug mode (?dbg=1)
const testFiles = [
    "/teachertool/validator-plans-test.json",
    "/teachertool/validator-plans-shared-test.json"
]

interface ValidatorPlansInfo {
    validatorPlans: pxt.blocks.ValidatorPlan[];
}

export async function loadValidatorPlans() {
    const { dispatch } = stateAndDispatch();
    const planFiles = pxt.options.debug ? prodFiles.concat(testFiles) : prodFiles;

    let allPlans: pxt.blocks.ValidatorPlan[] = [];
    for (const planFile of planFiles) {
        let fileContent = "";
        try {
            const response = await fetch(planFile);
            fileContent = await response.text();
        } catch (e) {
            logError("fetch_validator_plans_failed", e as string, { file: planFile });
            continue;
        }

        if (!fileContent) {
            // Empty file.
            continue;
        }

        try {
            const plansInfo = JSON.parse(fileContent) as ValidatorPlansInfo;
            allPlans = allPlans.concat(plansInfo.validatorPlans ?? []);
        } catch (e) {
            logError("parse_validator_plans_failed", e as string, {file: planFile});
            continue;
        }
    }

    dispatch(Actions.setValidatorPlans(allPlans));
}