import { Modal, ModalAction } from "react-common/components/controls/Modal";

export default function Render(props: {
    title: string;
    message: string | JSX.Element;
    onConfirm: () => any;
    onCancel: () => any;
}) {
    const { title, message, onConfirm, onCancel } = props;

    const actions: ModalAction[] = [
        {
            label: lf("Cancel"),
            className: "primary",
            onClick: onCancel,
        },
        {
            label: lf("Confirm"),
            className: "primary",
            onClick: onConfirm,
        },
    ];

    return (
        <Modal title={title} actions={actions} onClose={onCancel}>
            <div className="tw-flex tw-flex-col tw-gap-4">
                <div className="tw-text-center">{message}</div>
            </div>
        </Modal>
    );
}
