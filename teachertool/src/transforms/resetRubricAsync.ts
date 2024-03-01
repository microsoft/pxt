import { stateAndDispatch } from "../state";
import { isRubricLoaded } from "../state/helpers";
import * as Actions from "../state/actions";
import { setRubric } from "./setRubric";
import { confirmAsync } from "./confirmAsync";
import { makeRubric } from "../utils";
import { Strings } from "../constants";

export async function resetRubricAsync() {
    const { state: teachertool, dispatch } = stateAndDispatch();

    if (isRubricLoaded(teachertool)) {
        if (!(await confirmAsync(Strings.ConfirmReplaceRubricMsg))) {
            return;
        }
    }

    setRubric(makeRubric());

    dispatch(Actions.setActiveTab("rubric"));
}
