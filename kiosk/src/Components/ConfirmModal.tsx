import * as React from "react";
import { Modal, ModalAction } from "./Modal";
import { playSoundEffect } from "../Services/SoundEffectService";

interface IProps extends React.PropsWithChildren<{}> {
    title: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => any;
    onCancel: () => any;
}

const ConfirmModal: React.FC<IProps> = ({
    title,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    children,
}) => {
    const actions: ModalAction[] = [
        {
            label: cancelLabel ?? lf("Cancel"),
            onClick: onCancel,
            autofocus: true,
        },
        {
            label: confirmLabel ?? lf("Confirm"),
            onClick: onConfirm,
        },
    ];

    React.useEffect(() => {
        playSoundEffect("notification");
    }, []);

    return (
        <Modal title={title} actions={actions} onClose={onCancel}>
            {children}
        </Modal>
    );
};

export default ConfirmModal;
