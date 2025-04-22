import { logDebug } from "../services/loggingService";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";

export function hideModal() {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    if (teacherTool.modalOptions !== undefined) {
        dispatch(Actions.hideModal());
    } else {
        logDebug(`Trying to hide model when no modal is active`);
    }
}
