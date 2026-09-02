import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { setCatalogOpen } from "./setCatalogOpen";

export function setAskAiOpen(open: boolean) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    if (open) {
        // Prevent overlapping overlays.
        if (teacherTool.catalogOpen) {
            setCatalogOpen(false);
        }
    }

    if (teacherTool.askAiOpen !== open) {
        dispatch(Actions.setAskAiOpen(open));
    }
}
