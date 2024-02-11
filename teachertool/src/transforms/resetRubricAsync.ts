import { stateAndDispatch } from "../state";
import { isRubricLoaded } from "../state/helpers";
import * as Actions from "../state/actions";
import { setRubric } from "./setRubric";
import { confirmClearRubricAsync } from "./confirmClearRubricAsync";
import { makeRubric } from "../utils";

export async function resetRubricAsync(fromUserInteraction: boolean) {
    const { state: teachertool, dispatch } = stateAndDispatch();

    if (fromUserInteraction && isRubricLoaded(teachertool)) {
        if (!await confirmClearRubricAsync()) {
            return;
        }
    }

    dispatch(Actions.clearAllEvalResults());
    setRubric(makeRubric());

    if (fromUserInteraction) {
        dispatch(Actions.setActiveTab("rubric"));
    }
}
