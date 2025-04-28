import css from "./styling/JoinModal.module.scss";
import { useContext, useMemo, useRef, useState } from "react";
import { AppStateContext } from "@/state/Context";
import { Button } from "react-common/components/controls/Button";
import { Link } from "react-common/components/controls/Link";
import { Input } from "react-common/components/controls/Input";
import { Modal } from "react-common/components/controls/Modal";
import { dismissModal, joinGameAsync } from "@/transforms";
import { JoinGameModalOptions } from "@/types";
import { cleanupJoinCode, generateRandomName } from "@/utils";
import { Keys, Strings } from "@/constants";

export function JoinModal() {
    const { state } = useContext(AppStateContext);
    let { modalOptions } = state;
    modalOptions = modalOptions as JoinGameModalOptions;
    const inputRef = useRef<HTMLInputElement>(null);
    const [buttonEnabled, setButtonEnabled] = useState(false);

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
                <Input
                    className={css["join-input"]}
                    placeholder={lf("A1B2C3")}
                    maxLength={6}
                    handleInputRef={inputRef}
                    onChange={() => setButtonEnabled(!!cleanupJoinCode(inputRef.current?.value))}
                />
                <Button
                    className={css["button"]}
                    label={Strings.JoinGame}
                    title={Strings.JoinGame}
                    disabled={!buttonEnabled}
                    onClick={async () => {
                        const initialKv = new Map<string, string>();
                        initialKv.set(Keys.Name, generateRandomName());
                        const joinCode = cleanupJoinCode(inputRef.current?.value);
                        if (joinCode) {
                            dismissModal();
                            await joinGameAsync(joinCode, initialKv);
                        } else {
                            if (inputRef.current) {
                                inputRef.current.value = "";
                            }
                        }
                    }}
                />
                <Link className={css["link"]} href="/plato#join-game" target="_blank">
                    {lf("How do I get a join code?")}
                </Link>
            </div>
        </Modal>
    );
}
