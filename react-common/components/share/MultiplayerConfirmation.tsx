/// <reference path="../types.d.ts" />

import { Button } from "../controls/Button";
import { Modal, ModalAction } from "../controls/Modal";



export interface MultiplayerConfirmationProps {
    onCancelClicked: () => void;
    onConfirmClicked: () => void;
}

export const MultiplayerConfirmation = (props: MultiplayerConfirmationProps) => {
    const { onCancelClicked, onConfirmClicked } = props;

    const actions: ModalAction[] = [
        {
            label: lf("Cancel"),
            onClick: onCancelClicked,
        },
        {
            label: lf("Share and Host"),
            onClick: onConfirmClicked,
            className: "primary"
        }
    ]

    return <Modal
        title={lf("Host a multiplayer game")}
        actions={actions}
        onClose={onCancelClicked}>
            {lf("This will share the code of your game publicly. Is that okay?")}
    </Modal>
}