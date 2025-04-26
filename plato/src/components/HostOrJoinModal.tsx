import { useContext, useMemo, useState } from "react";
import { AppStateContext } from "@/state/Context";
import css from "./HostOrJoinModal.module.scss";
import { Button } from "react-common/components/controls/Button"
import { Link } from "react-common/components/controls/Link"
import { Input } from "react-common/components/controls/Input"
import { Modal } from "react-common/components/controls/Modal"
import { dismissModal, showModal } from "@/transforms";
import { ShowHostOrJoinGameModalOptions } from "@/types";
import { classlist } from "@/utils";

export function HostOrJoinModal() {
    const { state } = useContext(AppStateContext);
    let { modalOptions } = state;
    modalOptions = modalOptions as ShowHostOrJoinGameModalOptions;

    if (!modalOptions || modalOptions.type !== "host-or-join-game") {
        return null;
    }

    const { tab } = modalOptions;

    const header = (
        <div className={css["header"]}>
            <Button className={classlist(css["tab"], tab === "host" ? css["active"] : undefined)} label={lf("Host")} title={lf("Host")} onClick={() => { showModal({ type: "host-or-join-game", tab: "host" }) }} />
            <Button className={classlist(css["tab"], tab === "join" ? css["active"] : undefined)} label={lf("Join")} title={lf("Join")} onClick={() => { showModal({ type: "host-or-join-game", tab: "join" }) }} />
        </div>
    );

    return (
        <Modal title={header} className={css["modal"]} onClose={() => { dismissModal() }}>

            <div className={css["content"]}>
                {tab === "host" ? (
                    <>
                        <div className={css["description"]}>Enter the share link:</div>
                        <Input
                            className={css["host-input"]}
                            placeholder={lf("https://makecode.com/_XXXXXXXXX")}
                        />
                        <Button
                            className={css["button"]}
                            label={lf("Start Game")}
                            title={lf("Start Game")}
                            onClick={() => { }} />
                        <Link
                            className={css["link"]}
                            href="/plato#host-game"
                            target="_blank">
                            {lf("How do I get a share link?")}
                        </Link>
                    </>
                ) : (
                    <>
                        <div className={css["description"]}>Enter the game code:</div>
                        <Input
                            className={css["join-input"]}
                            placeholder={lf("ABC 123")}
                        />
                        <Button
                            className={css["button"]}
                            label={lf("Join Game")}
                            title={lf("Join Game")}
                            onClick={() => { }} />
                        <Link
                            className={css["link"]}
                            href="/plato#join-game"
                            target="_blank">
                            {lf("How do I get a game code?")}
                        </Link>
                    </>
                )}
            </div>
        </Modal>
    );
}
