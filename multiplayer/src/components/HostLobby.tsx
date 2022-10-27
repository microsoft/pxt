import { useContext, useRef, useState } from "react";
import { Button } from "react-common/components/controls/Button";
import { Input } from "react-common/components/controls/Input";
import { startGameAsync } from "../epics";
import { clearModal } from "../state/actions";
import { AppStateContext } from "../state/AppStateContext";
import CopyButton from "./CopyButton";
import Loading from "./Loading";
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

    const joinCode = state.gameState?.joinCode;
    if (!joinCode) {
        return <Loading />;
    }

    const displayJoinCode = joinCode?.slice(0, 3) + " " + joinCode?.slice(3);

    const joinLinkBaseUrl = "aka.ms/a9";
    const inviteString = lf("Go to {0} and enter code", joinLinkBaseUrl);
    const fullJoinLink = `${joinLinkBaseUrl}?join=${joinCode}`; // TODO multiplayer : create full link

    return (
        <div className="tw-flex tw-flex-col tw-gap-1 tw-items-center tw-justify-between tw-bg-white tw-py-[3rem] tw-px-[7rem] tw-shadow-lg tw-rounded-lg">
            <div className="tw-mt-3 tw-text-lg tw-text-center tw-text-neutral-700">
                {inviteString}
            </div>
            <div className="tw-text-4xl tw-mt-4 tw-flex tw-flex-row tw-items-center">
                {displayJoinCode}
                <div className="tw-ml-2 tw-text-[75%]">
                    <CopyButton
                        copyValue={joinCode}
                        title={lf("Copy join link")}
                        eventName="mp.hostlobby.copyjoinlink"
                    />
                </div>
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
