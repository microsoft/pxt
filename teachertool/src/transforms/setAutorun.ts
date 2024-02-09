import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import * as Storage from "../services/storageService";
import * as AutorunService from "../services/autorunService";

export function setAutorun(autorun: boolean) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.setAutorun(autorun));
    Storage.setAutorun(autorun);
    AutorunService.poke();
}
