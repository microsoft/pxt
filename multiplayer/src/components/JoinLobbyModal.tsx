import { useContext } from "react";
import { Modal } from "react-common/components/controls/Modal";
import { AppStateContext } from "../state/AppStateContext";

export default function Render() {
    const { state } = useContext(AppStateContext);

    return (
        <Modal title={lf("Lobby")}>
            <div className="tw-flex tw-flex-col tw-items-center tw-space-y-1 tw-text-lg tw-font-bold">
                <div>{lf("Waiting for players.")}</div>
                <div>{lf("Your host will start the game soon.")}</div>
            </div>
        </Modal>
    );
}
