import { stateAndDispatch } from "@/state";
import * as Actions from "@/state/actions";
import { makeToast, Toast, ToastWithId } from "@/components/Toaster";

export function showToast(toast: Toast | ToastWithId) {
    const { dispatch } = stateAndDispatch();
    if (!(toast as any).id) {
        toast = makeToast(toast);
    }
    dispatch(Actions.showToast(toast as ToastWithId));
}
