import { Modal } from "../../../../react-common/components/controls/Modal";
import { lf } from "./types";

interface Props {
    onClose(): void;
}

export const DeleteErrorModal = (props: Props) => {
    const { onClose } = props;

    return (
        <Modal
            title={lf("Cannot Delete")}
            onClose={onClose}
            actions={[
                {
                    label: lf("Okay"),
                    onClick: onClose
                }
            ]}
        >
            <p>{lf("Songs must have at least one track.")}</p>
        </Modal>
    )
}