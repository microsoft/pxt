import { Strings } from "../constants";
import { fetchJsonDocAsync } from "../services/backendRequests";
import { verifyRubricIntegrity } from "../state/helpers";
import { Rubric } from "../types/rubric";
import { makeToast } from "../utils";
import { replaceActiveRubricAsync } from "./replaceActiveRubricAsync";
import { showToast } from "./showToast";

export async function loadRubricAsync(rubricUrl: string) {
    const json = await fetchJsonDocAsync<Rubric | undefined>(rubricUrl);

    if (!json) {
        showToast(makeToast("error", Strings.ErrorLoadingChecklistMsg));
        return;
    }

    const { valid } = verifyRubricIntegrity(json);

    if (!valid) {
        showToast(makeToast("error", Strings.ErrorLoadingChecklistMsg));
        return;
    }

    await replaceActiveRubricAsync(json);
}
