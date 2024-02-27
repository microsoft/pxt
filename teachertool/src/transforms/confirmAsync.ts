import { stateAndDispatch } from "../state";
import { CautionLevel } from "../types";
import { showModal } from "./showModal";
import * as Actions from "../state/actions";

export async function confirmAsync(title: string, message: string, cautionLevel: CautionLevel): Promise<boolean> {
    const { dispatch } = stateAndDispatch();
    return new Promise<boolean>(resolve => {
        dispatch(
            Actions.setConfirmationProps({
                title,
                message,
                cautionLevel,
                onCancel: () => resolve(false),
                onContinue: () => resolve(true),
            })
        );
        showModal("confirmation");
    });
}
