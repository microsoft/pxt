import { logDebug } from "../services/loggingService";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";

export async function hideCatalog() {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    if (teacherTool.modal === "catalog-display") {
        dispatch(Actions.hideModal());
    } else {
        logDebug("hideCatalog called when catalog-display modal was not open");
    }
}