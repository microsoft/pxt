import { stateAndDispatch } from "../state";
import { setChecklist } from "./setChecklist";

export function setChecklistName(name: string) {
    const { state: teacherTool } = stateAndDispatch();

    const oldName = teacherTool.checklist.name;

    if (oldName === name) {
        return;
    }

    const newChecklist = {
        ...teacherTool.checklist,
        name,
    };
    setChecklist(newChecklist);
}
