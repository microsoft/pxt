import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";

export async function showCatalog() {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.showModal("catalog-display"));
}