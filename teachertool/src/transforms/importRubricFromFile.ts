import { logDebug } from "../services/loggingService";
import { postNotification } from "./postNotification";
import { makeNotification } from "../utils";
import { setRubric } from "./setRubric";
import { loadRubricFromFileAsync } from "../services/fileSystemService";

export async function importRubricFromFile(file: File) {
    const rubric = await loadRubricFromFileAsync(file);

    if (rubric) {
        logDebug(`Loading rubric '${rubric.name}' from file...`);
        const success = setRubric(rubric, true /* validateRubric */, false /* continueOnCriteriaFailure */);

        if (!success) {
            postNotification(makeNotification(lf("Unable to import rubric."), 2000));
        }
    } else {
        postNotification(makeNotification(lf("Unable to read rubric file."), 2000));
    }
}
