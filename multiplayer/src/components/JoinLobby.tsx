import { useContext } from "react";
import { Modal } from "react-common/components/controls/Modal";
import { AppStateContext } from "../state/AppStateContext";

export default function Render() {
    const { state } = useContext(AppStateContext);

    return (
        <div>
            <div className="tw-flex tw-flex-col tw-items-center tw-text-lg tw-space-y-4 tw-bg-white tw-py-[3rem] tw-px-[7rem] tw-shadow-lg tw-rounded-lg">
                <div>{lf("Waiting for players.")}</div>
                <div>{lf("Your host will start the game soon.")}</div>
            </div>
        </div>
    );
}
