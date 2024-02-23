import { Strings } from "../constants";
import { fetchJsonDocAsync } from "../services/backendRequests";
import { verifyRubricIntegrity } from "../state/helpers";
import { Rubric } from "../types/rubric";
import { makeToast } from "../utils";
import { confirmAsync } from "./confirmAsync";
import { setActiveTab } from "./setActiveTab";
import { setRubric } from "./setRubric";
import { showToast } from "./showToast";

export async function loadRubricAsync(rubricUrl: string) {
    if (!(await confirmAsync(Strings.ConfirmReplaceRubricMsg))) {
        return;
    }

    const json = await fetchJsonDocAsync<Rubric | undefined>(rubricUrl);

    if (!json) {
        showToast(makeToast("error", Strings.ErrorLoadingRubricMsg));
        return;
    }

    const { valid } = verifyRubricIntegrity(json);

    if (!valid) {
        showToast(makeToast("error", Strings.ErrorLoadingRubricMsg));
        return;
    }

    setRubric(json);
    setActiveTab("rubric");
}
