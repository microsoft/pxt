import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { ModalType } from "../types";

export function showModal(modal: ModalType) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.showModal(modal));
}
