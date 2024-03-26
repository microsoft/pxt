import { stateAndDispatch } from "../state";
import { showModal } from "./showModal";
import { ConfirmationModalOptions } from "../types/modalOptions";
import * as Actions from "../state/actions";

export async function confirmAsync(title: string, message: string): Promise<boolean> {
    const { dispatch } = stateAndDispatch();
    return new Promise<boolean>(resolve => {
        dispatch(
            Actions.setModalOptions({
                modal: "confirmation",
                title,
                message,
                onCancel: () => resolve(false),
                onContinue: () => resolve(true),
            } as ConfirmationModalOptions)
        );
        showModal("confirmation");
    });
}
