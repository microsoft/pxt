import * as React from "react";
import { Modal, ModalAction } from "react-common/components/controls/Modal";

export default function Render(
    props: React.PropsWithChildren<{
        title: string;
        confirmLabel?: string;
        cancelLabel?: string;
        onConfirm: () => any;
        onCancel: () => any;
    }>
) {
    const { title, confirmLabel, cancelLabel, children, onConfirm, onCancel } = props;

    const actions: ModalAction[] = [
        {
            label: cancelLabel ?? lf("Cancel"),
            className: "primary inverted",
            onClick: onCancel,
        },
        {
            label: confirmLabel ?? lf("Confirm"),
            className: "primary",
            onClick: onConfirm,
        },
    ];

    return (
        <Modal title={title} actions={actions} onClose={onCancel}>
            {children}
        </Modal>
    );
}
