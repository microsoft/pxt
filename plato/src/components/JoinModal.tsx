import css from "./JoinModal.module.scss";
import { useContext, useMemo, useState } from "react";
import { AppStateContext } from "@/state/Context";
import { Button } from "react-common/components/controls/Button";
import { Link } from "react-common/components/controls/Link";
import { Input } from "react-common/components/controls/Input";
import { Modal } from "react-common/components/controls/Modal";
import { dismissModal, showModal } from "@/transforms";
import { JoinGameModalOptions } from "@/types";
import { classlist } from "@/utils";
import { Strings } from "@/constants";

export function JoinModal() {
    const { state } = useContext(AppStateContext);
    let { modalOptions } = state;
    modalOptions = modalOptions as JoinGameModalOptions;

    if (!modalOptions || modalOptions.type !== "join-game") {
        return null;
    }

    const header = (
        <>
            <span className={css["header"]}>{Strings.JoinGame}</span>
        </>
    );

    return (
        <Modal
            title={header}
            className={css["modal"]}
            onClose={() => {
                dismissModal();
            }}
        >
            <div className={css["content"]}>
                <div className={css["description"]}>{Strings.EnterGameCode}</div>
                <Input className={css["join-input"]} placeholder={lf("A1B2C3")} />
                <Button
                    className={css["button"]}
                    label={Strings.JoinGame}
                    title={Strings.JoinGame}
                    onClick={() => {}}
                />
                <Link className={css["link"]} href="/plato#join-game" target="_blank">
                    {lf("How do I get a game code?")}
                </Link>
            </div>
        </Modal>
    );
}
