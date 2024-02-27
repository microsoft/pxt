import { Strings } from "../constants";
import { stateAndDispatch } from "../state";
import { isRubricLoaded } from "../state/helpers";
import { Rubric } from "../types/rubric";
import { confirmAsync } from "./confirmAsync";
import { setActiveTab } from "./setActiveTab";
import { setRubric } from "./setRubric";

export async function replaceActiveRubricAsync(newRubric: Rubric): Promise<boolean> {
    const { state: teacherTool } = stateAndDispatch();

    if (isRubricLoaded(teacherTool) && !(await confirmAsync(Strings.ConfirmReplaceRubricMsg))) {
        return false;
    }

    setRubric(newRubric);
    setActiveTab("rubric");
    return true;
}
