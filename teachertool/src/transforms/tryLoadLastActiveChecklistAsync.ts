import { getLastActiveChecklistAsync } from "../services/storageService";
import { logDebug } from "../services/loggingService";
import { showToast } from "./showToast";
import { makeToast } from "../utils";
import { setChecklist } from "./setChecklist";
import { verifyChecklistIntegrity } from "../state/helpers";

export async function tryLoadLastActiveChecklistAsync() {
    const lastActiveChecklist = await getLastActiveChecklistAsync();

    if (lastActiveChecklist) {
        logDebug("Loading last active checklist...", lastActiveChecklist);

        const checklistVerificationResult = verifyChecklistIntegrity(lastActiveChecklist);

        if (!checklistVerificationResult.valid) {
            showToast(makeToast("error", lf("Some criteria could not be loaded.")));
        }

        setChecklist({ ...lastActiveChecklist, criteria: checklistVerificationResult.validCriteria });
    } else {
        logDebug(`No last active checklist to load.`);
    }
}
