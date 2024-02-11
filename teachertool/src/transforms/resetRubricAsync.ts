import { stateAndDispatch } from "../state";
import { isRubricLoaded } from "../state/helpers";
import * as Actions from "../state/actions";
import { setRubric } from "./setRubric";
import { confirmAsync } from "./confirmAsync";
import { makeRubric } from "../utils";
import { Strings } from "../constants";

export async function resetRubricAsync(fromUserInteraction: boolean) {
    const { state: teachertool, dispatch } = stateAndDispatch();

    if (fromUserInteraction && isRubricLoaded(teachertool)) {
        if (!await confirmAsync(Strings.ConfirmReplaceRubric)) {
            return;
        }
    }

    dispatch(Actions.clearAllEvalResults());
    setRubric(makeRubric());

    if (fromUserInteraction) {
        dispatch(Actions.setActiveTab("rubric"));
    }
}
