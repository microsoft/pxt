import { stateAndDispatch } from "../State";
import * as Actions from "../State/Actions";

export function setKioskCode(code: string, expiration: number) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.setKioskCode(code, expiration));
}
