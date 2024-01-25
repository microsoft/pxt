import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";

export function showCatalogModal() {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.showModal("catalog-display"));
}