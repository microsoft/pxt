import { Strings, Ticks } from "../constants";
import { fetchJsonDocAsync } from "../services/backendRequests";
import { logError } from "../services/loggingService";
import { verifyChecklistIntegrity } from "../state/helpers";
import { Checklist } from "../types/checklist";
import { ErrorCode } from "../types/errorCode";
import { getChecklistHash, makeToast } from "../utils";
import { replaceActiveChecklistAsync } from "./replaceActiveChecklistAsync";
import { showToast } from "./showToast";

export async function loadChecklistAsync(checklistUrl: string) {
    const checklist = await fetchJsonDocAsync<Checklist | undefined>(checklistUrl);

    if (!checklist) {
        showToast(makeToast("error", Strings.ErrorLoadingChecklistMsg));
        return;
    }

    const { valid } = verifyChecklistIntegrity(checklist);

    if (!valid) {
        logError(ErrorCode.invalidPremadeChecklist, { checklistUrl });
        showToast(makeToast("error", Strings.ErrorLoadingChecklistMsg));
        return;
    } else {
        pxt.tickEvent(Ticks.LoadChecklistFromUrl, { checklistUrl, checklistHash: getChecklistHash(checklist) });
    }

    await replaceActiveChecklistAsync(checklist);
}
