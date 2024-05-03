import { Strings } from "../constants";
import { fetchJsonDocAsync } from "../services/backendRequests";
import { verifyChecklistIntegrity } from "../state/helpers";
import { Checklist } from "../types/checklist";
import { makeToast } from "../utils";
import { replaceActiveChecklistAsync } from "./replaceActiveChecklistAsync";
import { showToast } from "./showToast";

export async function loadChecklistAsync(checklistUrl: string) {
    const json = await fetchJsonDocAsync<Checklist | undefined>(checklistUrl);

    if (!json) {
        showToast(makeToast("error", Strings.ErrorLoadingChecklistMsg));
        return;
    }

    const { valid } = verifyChecklistIntegrity(json);

    if (!valid) {
        showToast(makeToast("error", Strings.ErrorLoadingChecklistMsg));
        return;
    }

    await replaceActiveChecklistAsync(json);
}
