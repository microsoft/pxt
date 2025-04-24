import { stateAndDispatch } from "@/state";
import * as Actions from "@/state/actions";

export function dismissModal() {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.dismissModal());
}
