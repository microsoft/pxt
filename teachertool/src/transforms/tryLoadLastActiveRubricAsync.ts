import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { getLastActiveRubricAsync } from "../services/indexedDbService";
import { logDebug } from "../services/loggingService";

export async function tryLoadLastActiveRubricAsync() {
    const { dispatch } = stateAndDispatch();

    const lastActiveRubric = await getLastActiveRubricAsync();

    if (lastActiveRubric) {
        logDebug(`Loading last active rubric '${lastActiveRubric.name}'...`);
        dispatch(Actions.setRubric(lastActiveRubric));
    } else {
        logDebug(`No last active rubric to load.`);
    }
}