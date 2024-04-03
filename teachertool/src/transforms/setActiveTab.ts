import * as AutorunService from "../services/autorunService";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { TabName } from "../types";

export function setActiveTab(tabName: TabName) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    if (teacherTool.activeTab !== tabName) {
        if (tabName === "results") {
            AutorunService.poke(true);
        }

        dispatch(Actions.setActiveTab(tabName));
    }
}
