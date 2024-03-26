import { ModalType } from ".";

export interface ModalOptions {
    modal: ModalType;
}

export interface ConfirmationModalOptions extends ModalOptions {
    modal: "confirmation";
    title: string;
    message: string;
    onCancel: () => void;
    onContinue: () => void;
}

export interface BlockPickerOptions extends ModalOptions {
    modal: "block-picker";
    criteriaInstanceId: string;
    paramName: string;
}
