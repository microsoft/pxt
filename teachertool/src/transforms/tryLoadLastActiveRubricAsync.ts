import { getLastActiveRubricAsync } from "../services/indexedDbService";
import { logDebug, logError } from "../services/loggingService";
import { showToast } from "./showToast";
import { makeNotification } from "../utils";
import { setRubric } from "./setRubric";
import { verifyRubricIntegrity } from "../state/helpers";

export async function tryLoadLastActiveRubricAsync() {
    const lastActiveRubric = await getLastActiveRubricAsync();

    if (lastActiveRubric) {
        logDebug(`Loading last active rubric '${lastActiveRubric.name}'...`);

        const rubricVerificationResult = verifyRubricIntegrity(lastActiveRubric);

        if (!rubricVerificationResult.valid) {
            showToast(makeNotification("error", lf("Some criteria could not be loaded.")));
        }

        setRubric({ ...lastActiveRubric, criteria: rubricVerificationResult.validCriteria });
    } else {
        logDebug(`No last active rubric to load.`);
    }
}
