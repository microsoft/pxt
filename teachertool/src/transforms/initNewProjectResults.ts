import { stateAndDispatch } from "../state";
import { setEvalResultsPending } from "./setEvalResultsPending";
import * as Actions from "../state/actions";


export function initNewProjectResults() {
    const { state: teacherTool, dispatch } = stateAndDispatch();
    setEvalResultsPending({ clearAllEntries: true });
    for (const result of Object.keys(teacherTool.evalResults)) {
        delete teacherTool.evalResults[result].notes
    }
}