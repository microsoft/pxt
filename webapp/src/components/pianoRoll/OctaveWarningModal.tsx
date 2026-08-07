import { Modal } from "../../../../react-common/components/controls/Modal";
import { lf } from "./types";

interface Props {
    trackId: number;
    onClose(): void;
    onPaste(trackId: number): void;
}

export const OctaveWarningModal = (props: Props) => {
    const { trackId, onClose, onPaste } = props;

    const handlePaste = () => {
        onPaste(trackId);
        onClose();
    };

    return (
        <Modal
            title={lf("Octave Warning")}
            onClose={onClose}
            actions={[
                {
                    label: lf("Cancel"),
                    className: "neutral",
                    onClick: onClose
                },
                {
                    label: lf("Paste Anyway"),
                    className: "red",
                    onClick: handlePaste
                }
            ]}
        >
            <p>{lf("The copied notes are outside the current track's octave range. If you paste, it will change the octave range of this track.")}</p>
        </Modal>
    )
}