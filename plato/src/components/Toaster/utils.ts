import { nanoid } from "nanoid";
import { Toast, ToastWithId } from "./types";

export function makeToast(toast: Toast): ToastWithId {
    return {
        id: nanoid(),
        ...toast,
    };
}
