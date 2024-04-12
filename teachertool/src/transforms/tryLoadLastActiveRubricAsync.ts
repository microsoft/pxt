import { getLastActiveRubricAsync } from "../services/storageService";
import { logDebug } from "../services/loggingService";
import { showToast } from "./showToast";
import { makeToast } from "../utils";
import { setRubric } from "./setRubric";
import { verifyRubricIntegrity } from "../state/helpers";

export async function tryLoadLastActiveRubricAsync() {
    const lastActiveRubric = await getLastActiveRubricAsync();

    if (lastActiveRubric) {
        logDebug("Loading last active rubric...", lastActiveRubric);

        const rubricVerificationResult = verifyRubricIntegrity(lastActiveRubric);

        if (!rubricVerificationResult.valid) {
            showToast(makeToast("error", lf("Some criteria could not be loaded.")));
        }

        setRubric({ ...lastActiveRubric, criteria: rubricVerificationResult.validCriteria });
    } else {
        logDebug(`No last active rubric to load.`);
    }
}
