import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { TabName } from "../types";

export function setActiveTab(tabName: TabName) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    if (teacherTool.activeTab !== tabName) {
        dispatch(Actions.setActiveTab(tabName));
    }
}
