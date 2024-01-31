import { deleteRubric, saveRubric } from "../services/indexedDbService";
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
    }
    dispatch(Actions.setRubric(newRubric));

    // To save the renamed rubric, we can simply save a version with the new name,
    // and then delete the entry with the previous name.
    async function saveRenamedRubric() {
        await saveRubric(newRubric);
        await deleteRubric(oldName);
    }

    // Fire and forget. We don't need to wait for the operation to finish.
    saveRenamedRubric();
}
