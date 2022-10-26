import { useContext, useRef, useState } from "react";
import { Button } from "react-common/components/controls/Button";
import { Input } from "react-common/components/controls/Input";
import { Modal } from "react-common/components/controls/Modal";
import { startGameAsync } from "../epics";
import { clearModal } from "../state/actions";
import { AppStateContext } from "../state/AppStateContext";

export default function Render() {
    const { state, dispatch } = useContext(AppStateContext);
    const [copySuccessful, setCopySuccessful] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const onStartGameClick = async () => {
        pxt.tickEvent("mp.hostlobby.startgame");
        dispatch(clearModal());
        await startGameAsync();
    };

    const handleCopyClick = () => {
        if (pxt.BrowserUtils.isIpcRenderer()) {
            if (inputRef.current) {
                setCopySuccessful(
                    pxt.BrowserUtils.legacyCopyText(inputRef.current)
                );
            }
        } else {
            navigator.clipboard.writeText(joinLink);
            setCopySuccessful(true);
        }
    };

    const handleCopyBlur = () => {
        setCopySuccessful(false);
    };

    const joinLink = `${state.gameState?.joinCode}`; // TODO multiplayer : create full link
    return (
        <div title={lf("Invite Players")}>
            <div className="tw-flex tw-flex-col tw-gap-1 tw-items-center">
                <div className="tw-flex tw-flex-col tw-items-center">
                    <div>
                        {lf("Invite anyone to join your game instantly.")}
                    </div>
                    <div className="tw-mt-1">
                        {lf("Just send them a link.")}
                    </div>
                    <div className="common-input-attached-button tw-m-5 tw-w-full">
                        <Input
                            ariaLabel={lf("join game link")}
                            handleInputRef={inputRef}
                            initialValue={joinLink}
                            readOnly={true}
                        />
                        <Button
                            className={copySuccessful ? "green" : "primary"}
                            title={lf("Copy link")}
                            label={copySuccessful ? lf("Copied!") : lf("Copy")}
                            leftIcon="fas fa-link"
                            onClick={handleCopyClick}
                            onBlur={handleCopyBlur}
                        />
                    </div>
                </div>
                {state.gameState?.gameMode === "lobby" && (
                    <Button
                        className={"teal"}
                        label={lf("Start Game")}
                        title={lf("Start Game")}
                        onClick={onStartGameClick}
                    />
                )}
            </div>
        </div>
    );
}
