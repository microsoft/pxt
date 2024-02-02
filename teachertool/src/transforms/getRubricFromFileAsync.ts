import { logDebug, logError } from "../services/loggingService";
import { postNotification } from "./postNotification";
import { makeNotification } from "../utils";
import { loadRubricFromFileAsync } from "../services/fileSystemService";
import { verifyRubricIntegrity } from "../state/helpers";
import { Rubric } from "../types/rubric";

export async function getRubricFromFileAsync(file: File, allowPartial: boolean): Promise<Rubric | undefined> {
    let rubric = await loadRubricFromFileAsync(file);

    if (rubric) {
        logDebug(`Loading rubric '${rubric.name}' from file...`);

        const rubricVerificationResult = verifyRubricIntegrity(rubric);

        if (!rubricVerificationResult.valid) {
            postNotification(makeNotification(lf("Rubric contains invalid criteria."), 2000));
            rubric = allowPartial ? {...rubric, criteria: rubricVerificationResult.validCriteria} : undefined;
        }
    } else {
        postNotification(makeNotification(lf("Unable to read rubric file."), 2000));
    }

    return rubric;
}
