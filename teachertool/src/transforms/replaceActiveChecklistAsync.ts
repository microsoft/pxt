import { Strings } from "../constants";
import { stateAndDispatch } from "../state";
import { isChecklistLoaded } from "../state/helpers";
import { Checklist } from "../types/checklist";
import { confirmAsync } from "./confirmAsync";
import { setActiveTab } from "./setActiveTab";
import { setChecklist } from "./setChecklist";

export async function replaceActiveChecklistAsync(newChecklist: Checklist): Promise<boolean> {
    const { state: teacherTool } = stateAndDispatch();

    const title =
        !newChecklist.name && !newChecklist.criteria?.length
            ? Strings.CreateEmptyChecklist
            : lf("Import '{0}'?", newChecklist.name ? newChecklist.name : Strings.UntitledChecklist);
    if (isChecklistLoaded(teacherTool) && !(await confirmAsync(title, Strings.ConfirmReplaceChecklistMsg))) {
        return false;
    }

    setChecklist(newChecklist);
    setActiveTab("results");
    return true;
}
