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
            onClick: onCancel,
        },
        {
            label: lf("Confirm"),
            onClick: onConfirm,
        },
    ];

    return (
        <Modal title={title} actions={actions} onClose={onCancel}>
            <div className="tw-flex tw-flex-col tw-gap-4">
                <div className="">{message}</div>
            </div>
        </Modal>
    );
}
