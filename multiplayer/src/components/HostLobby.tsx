import { useContext, useRef, useState } from "react";
import { Button } from "react-common/components/controls/Button";
import { Input } from "react-common/components/controls/Input";
import { startGameAsync } from "../epics";
import { clearModal } from "../state/actions";
import { AppStateContext } from "../state/AppStateContext";
import JoinCodeLabel from "./JoinCodeLabel";
import PresenceBar from "./PresenceBar";

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
        pxt.tickEvent("mp.hostlobby.copyjoinlink");
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

    const joinLinkBaseUrl = "aka.ms/a9";
    const inviteString = lf("Go to {0} and enter code", joinLinkBaseUrl);

    const joinLink = `${state.gameState?.joinCode}`; // TODO multiplayer : create full link
    return (
        <div className="tw-flex tw-flex-col tw-gap-1 tw-items-center tw-justify-between tw-bg-white tw-py-[3rem] tw-px-[7rem] tw-shadow-lg tw-rounded-lg">
            <div className="tw-mt-3 tw-text-lg tw-text-center tw-text-neutral-700">
                {inviteString}
            </div>
            <div className="tw-text-4xl tw-mt-4">
                <JoinCodeLabel />
            </div>
            <Button
                className={"primary tw-mt-5 tw-mb-7"}
                label={lf("Start Game")}
                title={lf("Start Game")}
                onClick={onStartGameClick}
            />
            <PresenceBar />
        </div>
    );
}
