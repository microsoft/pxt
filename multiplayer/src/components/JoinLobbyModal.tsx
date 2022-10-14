import { useContext } from "react";
import { Modal } from "react-common/components/controls/Modal";
import { AppStateContext } from "../state/AppStateContext";

export default function Render() {
    const { state } = useContext(AppStateContext);

    return (
        <Modal title={"Lobby"}>
            <div className="tw-flex tw-flex-col tw-gap-1">
                <div className="tw-mt-5">
                    <div className="tw-text-lg tw-font-bold">
                        {lf("Waiting for Players...")}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
