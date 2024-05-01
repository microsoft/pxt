import { Strings } from "../constants";
import { stateAndDispatch } from "../state";
import { isRubricLoaded } from "../state/helpers";
import { Rubric } from "../types/rubric";
import { confirmAsync } from "./confirmAsync";
import { setActiveTab } from "./setActiveTab";
import { setRubric } from "./setRubric";

export async function replaceActiveRubricAsync(newRubric: Rubric): Promise<boolean> {
    const { state: teacherTool } = stateAndDispatch();

    const title =
        !newRubric.name && !newRubric.criteria?.length
            ? Strings.CreateEmptyChecklist
            : lf("Import '{0}'?", newRubric.name ? newRubric.name : Strings.UntitledChecklist);
    if (isRubricLoaded(teacherTool) && !(await confirmAsync(title, Strings.ConfirmReplaceChecklistMsg))) {
        return false;
    }

    setRubric(newRubric);
    setActiveTab("rubric");
    return true;
}
