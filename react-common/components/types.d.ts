/// <reference path="../../built/pxtlib.d.ts" />


interface DialogOptions {
    type?: string;
    hideCancel?: boolean;
    disagreeLbl?: string;
    disagreeClass?: string;
    disagreeIcon?: string;
    logos?: string[];
    className?: string;
    header: string;
    headerIcon?: string;
    body?: string;
    jsx?: JSX.Element;
    jsxd?: () => JSX.Element; // dynamic-er version of jsx
    copyable?: string;
    size?: "" | "small" | "fullscreen" | "large" | "mini" | "tiny"; // defaults to "small"
    onLoaded?: (_: HTMLElement) => void;
    // buttons?: sui.ModalButton[];
    timeout?: number;
    modalContext?: string;
    hasCloseIcon?: boolean;
    helpUrl?: string;
    bigHelpButton?: boolean;
    confirmationText?: string;      // Display a text input the user must type to confirm.
    confirmationCheckbox?: string;  // Display a checkbox the user must check to confirm.
    confirmationGranted?: boolean;
    onClose?: () => void;
}