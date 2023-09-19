import { stateAndDispatch } from "../State";
import { KioskState } from "../Types";
import * as Actions from "../State/Actions";

export function navigate(nextState: KioskState) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.setKioskState(nextState));
}
