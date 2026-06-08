import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { setAskAiOpen } from "./setAskAiOpen";

export function setCatalogOpen(open: boolean) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    if (open) {
        // Prevent overlapping overlays.
        if (teacherTool.askAiOpen) {
            setAskAiOpen(false);
        }
    }

    if (teacherTool.catalogOpen != open) {
        dispatch(Actions.setCatalogOpen(open));
    }
}
