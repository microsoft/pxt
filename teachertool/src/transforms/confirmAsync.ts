import { stateAndDispatch } from "../state";
import { showModal } from "./showModal";
import * as Actions from "../state/actions";

export async function confirmAsync(title: string, message: string): Promise<boolean> {
    const { dispatch } = stateAndDispatch();
    return new Promise<boolean>(resolve => {
        dispatch(
            Actions.setConfirmationOptions({
                title,
                message,
                onCancel: () => resolve(false),
                onContinue: () => resolve(true),
            })
        );
        showModal("confirmation");
    });
}
