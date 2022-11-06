import { state } from "../../state";
import { Modal, ModalAction } from "react-common/components/controls/Modal";

export default function Render(props: { onResume?: () => any }) {
    const { onResume } = props;
    const { clientRole } = state;

    const actions: ModalAction[] = [
        {
            label: lf("Resume Game"),
            className: "primary",
            onClick: onResume!,
        },
    ];

    return (
        <Modal
            title={lf("Game Paused")}
            actions={clientRole === "host" ? actions : undefined}
            hideDismissButton={true}
        >
            {clientRole === "host" && (
                <div className="tw-flex tw-flex-col tw-gap-4">
                    <div className="tw-text-center">
                        {lf("The game is paused. Press the resume button to continue.")}
                    </div>
                </div>
            )}
            {clientRole !== "host" && (
                <div className="tw-flex tw-flex-col tw-gap-4">
                    <div className="tw-text-center">
                        {lf("The game is paused. Please wait for the host to resume the game.")}
                    </div>
                </div>
            )}
        </Modal>
    );
}
