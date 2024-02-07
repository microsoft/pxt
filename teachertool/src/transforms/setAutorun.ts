import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import * as LocalStorage from "../services/localStorage";
import * as AutorunService from "../services/autorunService";

export function setAutorun(autorun: boolean) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.setAutorun(autorun));
    LocalStorage.setAutorun(autorun);
    AutorunService.poke();
}
