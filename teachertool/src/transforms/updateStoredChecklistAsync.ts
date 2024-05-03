import { deleteChecklistAsync, saveChecklistAsync } from "../services/storageService";
import { Checklist } from "../types/checklist";

export async function updateStoredChecklistAsync(oldChecklist: Checklist | undefined, newChecklist: Checklist | undefined) {
    const renamed = oldChecklist && newChecklist && oldChecklist?.name !== newChecklist.name;
    const deleted = oldChecklist && !newChecklist;

    if (newChecklist) {
        await saveChecklistAsync(newChecklist);
    }

    if (renamed || deleted) {
        await deleteChecklistAsync(oldChecklist.name);
    }
}
