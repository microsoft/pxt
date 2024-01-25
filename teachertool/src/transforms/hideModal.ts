import { logDebug } from "../services/loggingService";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { ModalType } from "../types";

export function hideModal(modal: ModalType) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    if (teacherTool.modal === modal) {
        dispatch(Actions.hideModal());
    } else {
        logDebug(`Trying to hide '${modal}' model when it was not active`);
    }
}