import { Modal } from "../../../../react-common/components/controls/Modal";
import { lf } from "./types";

interface Props {
    trackId: number;
    onClose(): void;
    onDelete(trackId: number): void;
}

export const DeleteTrackModal = (props: Props) => {
    const { trackId, onClose, onDelete } = props;

    const handleDelete = () => {
        onDelete(trackId);
        onClose();
    };

    return (
        <Modal
            title={lf("Delete Track")}
            onClose={onClose}
            actions={[
                {
                    label: lf("Cancel"),
                    onClick: onClose
                },
                {
                    label: lf("Delete"),
                    className: "danger",
                    onClick: handleDelete
                }
            ]}
        >
            <p>{lf("Are you sure you want to delete this track? This action cannot be undone.")}</p>
        </Modal>
    )
}