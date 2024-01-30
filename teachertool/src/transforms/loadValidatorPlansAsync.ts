import { loadTestableCollectionFromDocsAsync } from "../services/backendRequests";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";

const files = [
    "/teachertool/validator-plans.json", // target-specific catalog
    "/teachertool/validator-plans-shared.json", // shared across all targets
];

export async function loadValidatorPlansAsync() {
    const { dispatch } = stateAndDispatch();
    const plans = await loadTestableCollectionFromDocsAsync<pxt.blocks.ValidatorPlan>(files, "validatorPlans");
    dispatch(Actions.setValidatorPlans(plans));
}
