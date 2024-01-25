import { logError } from "../services/loggingService";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { ErrorCode } from "../types/errorCode";

const prodFiles = [
    "/teachertool/validator-plans.json", // target-specific catalog
    "/teachertool/validator-plans-shared.json" // shared across all targets
];

// Catalog entries still being tested, will only appear when test catalogs are enabled (?testcatalog=1 or ?tc=1)
const testFiles = [
    "/teachertool/validator-plans-test.json",
    "/teachertool/validator-plans-shared-test.json"
]

interface ValidatorPlansInfo {
    validatorPlans: pxt.blocks.ValidatorPlan[];
}

export async function loadValidatorPlansAsync() {
    const { state: teacherTool, dispatch } = stateAndDispatch();
    const planFiles = teacherTool.flags.testCatalog ? prodFiles.concat(testFiles) : prodFiles;

    let allPlans: pxt.blocks.ValidatorPlan[] = [];
    for (const planFile of planFiles) {
        try {
            const response = await fetch(planFile);
            const content = await response.json() as ValidatorPlansInfo;
            allPlans = allPlans.concat(content.validatorPlans ?? []);
        } catch (e) {
            logError(ErrorCode.loadValidatorPlansFailed, e, { file: planFile });
            continue;
        }
    }

    dispatch(Actions.setValidatorPlans(allPlans));
}