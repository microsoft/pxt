import { useContext, useState } from "react";
import { AppStateContext } from "@/state/Context";
import css from "./HostOrJoinModal.module.scss";
import { Button } from "react-common/components/controls/Button"
import { Link } from "react-common/components/controls/Link"
import { Modal } from "react-common/components/controls/Modal"
import { dismissModal } from "@/transforms";
import { ShowHostOrJoinGameModalOptions } from "@/types";

export function HostOrJoinModal() {
    const { state } = useContext(AppStateContext);
    let { modalOptions } = state;
    modalOptions = modalOptions as ShowHostOrJoinGameModalOptions;
    const [tab, setTab] = useState(modalOptions?.tab ?? "host");
    if (!modalOptions || modalOptions.type !== "host-or-join-game") {
        return null;
    }
    return (
        <Modal title={lf("Host or Join a Game")} className={css["host-or-join-modal"]} onClose={() => {dismissModal()}}>
            <div className={css["host-or-join-modal-content"]}>
                <Button className={css["host-button"]} label={lf("Host a Game")} title={lf("Host a Game")} onClick={() => {}} />
                <Button className={css["join-button"]} label={lf("Join a Game")} title={lf("Join a Game")} onClick={() => {}} />
            </div>
        </Modal>
    );
}
