import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { UserFeedback } from "../types";

export function setUserFeedback(criteriaInstanceId: string, userFeedback: UserFeedback) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.setUserFeedback(criteriaInstanceId, userFeedback));
}
