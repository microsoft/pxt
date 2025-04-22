import { showModal } from "./showModal";
import { ConfirmationModalOptions } from "../types/modalOptions";

export async function confirmAsync(title: string, message: string): Promise<boolean> {
    return new Promise<boolean>(resolve => {
        showModal({
            modal: "confirmation",
            title,
            message,
            onCancel: () => resolve(false),
            onContinue: () => resolve(true),
        } as ConfirmationModalOptions);
    });
}
