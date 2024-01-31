import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";

export function setRubricName(name: string) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    const oldName = teacherTool.rubric.name;

    if (oldName === name) {
        return;
    }

    const newRubric = {
        ...teacherTool.rubric,
        name,
    };
    dispatch(Actions.setRubric(newRubric));
}
