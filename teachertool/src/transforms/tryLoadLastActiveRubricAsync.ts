import { getLastActiveRubricAsync } from "../services/indexedDbService";
import { logDebug } from "../services/loggingService";
import { postNotification } from "./postNotification";
import { makeNotification } from "../utils";
import { setRubric } from "./setRubric";

export async function tryLoadLastActiveRubricAsync() {
    const lastActiveRubric = await getLastActiveRubricAsync();

    if (lastActiveRubric) {
        logDebug(`Loading last active rubric '${lastActiveRubric.name}'...`);

        const success = setRubric(lastActiveRubric, true /* validateRubric */, true /* continueOnCriteriaFailure */);

        if (!success) {
            postNotification(makeNotification(lf("Some criteria could not be loaded."), 2000));
        }
    } else {
        logDebug(`No last active rubric to load.`);
    }
}
