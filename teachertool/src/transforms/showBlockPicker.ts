import { stateAndDispatch } from "../state";
import { showModal } from "./showModal";
import * as Actions from "../state/actions";
import { BlockPickerOptions } from "../types/modalOptions";

export function showBlockPicker(criteriaInstanceId: string, paramName: string) {
    const { dispatch } = stateAndDispatch();

    dispatch(
        Actions.setModalOptions({
            modal: "block-picker",
            criteriaInstanceId,
            paramName,
        } as BlockPickerOptions)
    );

    showModal("block-picker");
}
