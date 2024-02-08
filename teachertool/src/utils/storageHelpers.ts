import { Rubric } from "../types/rubric";
import * as LocalStorage from "../services/localStorage";
import * as IndexedDb from "../services/indexedDbService";

export async function getLastActiveRubricAsync(): Promise<Rubric | undefined> {
    const lastActiveRubricName = LocalStorage.getLastActiveRubricName();
    return await IndexedDb.getRubricFromIndexedDbAsync(lastActiveRubricName);
}

export async function saveRubricAsync(rubric: Rubric) {
    await IndexedDb.saveRubricToIndexedDbAsync(rubric);
    LocalStorage.setLastActiveRubricName(rubric.name);
}

export async function deleteRubricAsync(name: string) {
    await IndexedDb.deleteRubricFromIndexedDbAsync(name);

    if (LocalStorage.getLastActiveRubricName() === name) {
        LocalStorage.setLastActiveRubricName("");
    }
}
