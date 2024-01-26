import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { loadTestableCollectionFromFileAsync } from "../utils/fileSystemHelpers";

const files = [
    "/teachertool/validator-plans.json", // target-specific catalog
    "/teachertool/validator-plans-shared.json" // shared across all targets
];

export async function loadValidatorPlansAsync() {
    const { dispatch } = stateAndDispatch();
    const plans = await loadTestableCollectionFromFileAsync<pxt.blocks.ValidatorPlan>(files, "validatorPlans");
    dispatch(Actions.setValidatorPlans(plans));
}