import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { ModalOptions } from "../types/modalOptions";

export function showModal(modal: ModalOptions) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.showModal(modal));
}
