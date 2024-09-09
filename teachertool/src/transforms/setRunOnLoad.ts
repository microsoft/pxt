import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import * as Storage from "../services/storageService";
import { runEvaluateAsync } from "./runEvaluateAsync";

export function setRunOnLoad(runOnLoad: boolean) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.setRunOnLoad(runOnLoad));
    Storage.setRunOnLoad(runOnLoad);
}
