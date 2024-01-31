import { stateAndDispatch } from "../state";
import { CriteriaInstance } from "../types/criteria";
import * as Actions from "../state/actions";

export function importRubric(serializedRubric: string) {
    const { dispatch } = stateAndDispatch();
    const selectedCriteria = JSON.parse(serializedRubric) as CriteriaInstance[];
    dispatch(Actions.setSelectedCriteria(selectedCriteria));
}