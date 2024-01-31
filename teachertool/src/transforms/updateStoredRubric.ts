import { deleteRubric, saveRubric } from "../services/indexedDbService";
import { Rubric } from "../types/rubric";

export async function updateStoredRubricAsync(oldRubric: Rubric | undefined, newRubric: Rubric | undefined) {
    const renamed = oldRubric && newRubric && oldRubric?.name !== newRubric.name;
    const deleted = oldRubric && !newRubric;

    if (newRubric) {
        await saveRubric(newRubric);
    }

    if (renamed || deleted) {
        await deleteRubric(oldRubric.name);
    }
}
