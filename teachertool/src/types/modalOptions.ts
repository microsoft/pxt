export type ConfirmationModalOptions = {
    modal: "confirmation";
    title: string;
    message: string;
    onCancel: () => void;
    onContinue: () => void;
};

export type BlockPickerOptions = {
    modal: "block-picker";
    criteriaInstanceId: string;
    paramName: string;
};

export type ImportRubricOptions = {
    modal: "import-rubric";
};

export type ModalOptions = ImportRubricOptions | ConfirmationModalOptions | BlockPickerOptions;
