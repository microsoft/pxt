import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";

export function showImportRubricModal() {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.showModal("import-rubric"));
}
