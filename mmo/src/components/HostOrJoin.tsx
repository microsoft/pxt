import { AppStateContext } from "@/state/Context";
import css from "./HostOrJoinModal.module.scss";
import { useContext, useEffect, useState } from "react";
import { Button } from "react-common/components/controls/Button"
import { Link } from "react-common/components/controls/Link"

export function HostOrJoin() {
    const { state } = useContext(AppStateContext);
    const { modalOptions } = state;

    return null;
/*
    return state.modalOptions?.type === "host-or-join" ? (
        <Modal className={css["host-or-join-modal"]} title={lf("Host or Join a Game")}>
            <div className={css["content"]}>
                <div className={css["header"]}>
                    <h2>{lf("Host a Game")}</h2>
                    <p>{lf("Create a new game and invite your friends to join.")}</p>
                </div>
                <Button label={lf("Host")} title={lf("Host")} onClick={() => {}} />
            </div>
            <div className={css["content"]}>
                <div className={css["header"]}>
                    <h2>{lf("Join a Game")}</h2>
                    <p>{lf("Enter the game code to join an existing game.")}</p>
                </div>
                <Button label={lf("Join")} title={lf("Join")} onClick={() => {}} />
            </div>
        </Modal>
    ) : null;
     */
}
