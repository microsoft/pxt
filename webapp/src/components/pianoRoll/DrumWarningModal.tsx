import { Modal } from "../../../../react-common/components/controls/Modal";
import { lf } from "./types";

interface Props {
    trackId: number;
    instrumentId: number;
    onClose(): void;
    onConfirm(trackId: number, instrumentId: number): void;
}

export const DrumWarningModal = (props: Props) => {
    const { trackId, instrumentId, onClose, onConfirm } = props;

    const handleConfirm = () => {
        onConfirm(trackId, instrumentId);
        onClose();
    };

    return (
        <Modal
            title={lf("Change Track Instrument")}
            onClose={onClose}
            actions={[
                {
                    label: lf("Cancel"),
                    onClick: onClose
                },
                {
                    label: lf("Confirm"),
                    className: "danger",
                    onClick: handleConfirm
                }
            ]}
        >
            <p>{lf("Switching between instruments and drums will cause all existing notes to be deleted. Are you sure you want to continue?")}</p>
        </Modal>
    )
}