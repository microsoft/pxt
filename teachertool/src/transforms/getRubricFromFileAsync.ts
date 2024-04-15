import { logDebug, logError } from "../services/loggingService";
import { loadRubricFromFileAsync } from "../services/fileSystemService";
import { verifyRubricIntegrity } from "../state/helpers";
import { Rubric } from "../types/rubric";

export async function getRubricFromFileAsync(file: File, allowPartial: boolean): Promise<Rubric | undefined> {
    let rubric = await loadRubricFromFileAsync(file);

    if (rubric) {
        logDebug("Loading rubric from file...", {file, rubric});

        const rubricVerificationResult = verifyRubricIntegrity(rubric);

        if (!rubricVerificationResult.valid) {
            rubric = allowPartial ? { ...rubric, criteria: rubricVerificationResult.validCriteria } : undefined;
        }
    }

    return rubric;
}
