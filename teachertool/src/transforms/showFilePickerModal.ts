import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";

export function showFilePickerModal() {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.showModal("file-picker"));
}
