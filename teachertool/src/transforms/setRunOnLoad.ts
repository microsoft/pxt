import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import * as Storage from "../services/storageService";

export function setRunOnLoad(runOnLoad: boolean) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.setRunOnLoad(runOnLoad));
    Storage.setRunOnLoad(runOnLoad);
}
