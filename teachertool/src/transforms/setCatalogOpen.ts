import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";

export function setCatalogOpen(open: boolean) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    if (teacherTool.catalogOpen != open) {
        dispatch(Actions.setCatalogOpen(open));
    }
}
