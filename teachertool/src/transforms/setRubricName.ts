import { stateAndDispatch } from "../state";
import { setRubric } from "./setRubric";

export function setRubricName(name: string) {
    const { state: teacherTool } = stateAndDispatch();

    const oldName = teacherTool.rubric.name;

    if (oldName === name) {
        return;
    }

    const newRubric = {
        ...teacherTool.rubric,
        name,
    };
    setRubric(newRubric);
}
