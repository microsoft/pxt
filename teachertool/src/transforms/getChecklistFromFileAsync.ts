import { logDebug } from "../services/loggingService";
import { loadChecklistFromFileAsync } from "../services/fileSystemService";
import { verifyChecklistIntegrity } from "../state/helpers";
import { Checklist } from "../types/checklist";

export async function getChecklistFromFileAsync(file: File, allowPartial: boolean): Promise<Checklist | undefined> {
    let checklist = await loadChecklistFromFileAsync(file);

    if (checklist) {
        logDebug("Loading checklist from file...", { file, checklist });

        const checklistVerificationResult = verifyChecklistIntegrity(checklist);

        if (!checklistVerificationResult.valid) {
            checklist = allowPartial ? { ...checklist, criteria: checklistVerificationResult.validCriteria } : undefined;
        }
    }

    return checklist;
}
