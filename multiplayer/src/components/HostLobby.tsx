import { useContext, useRef, useState } from "react";
import { Button } from "react-common/components/controls/Button";
import { Link } from "react-common/components/controls/Link";
import { startGameAsync } from "../epics";
import { clearModal } from "../state/actions";
import { AppStateContext } from "../state/AppStateContext";
import { makeJoinLink, SHORT_LINK } from "../util";
import CopyButton from "./CopyButton";
import Loading from "./Loading";
import PresenceBar from "./PresenceBar";

export default function Render() {
    const { state, dispatch } = useContext(AppStateContext);

    const onStartGameClick = async () => {
        pxt.tickEvent("mp.hostlobby.startgame");
        dispatch(clearModal());
        await startGameAsync();
    };

    const joinCode = state.gameState?.joinCode;
    if (!joinCode) {
        return null;
    }

    // To get a link in the middle of the invite string, we actually preserve the {0} and insert the link manually as an html element later.
    const inviteString = lf("Go to {0} and enter code", "{0}");
    const inviteStringSegments = inviteString.split("{0}");
    const shortLink = SHORT_LINK();

    // Insert a space to make the join code easier to read.
    const displayJoinCode = joinCode?.slice(0, 3) + " " + joinCode?.slice(3);
    const joinDeepLink = makeJoinLink(joinCode);

    return (
        <div className="tw-flex tw-flex-col tw-gap-1 tw-items-center tw-justify-between tw-bg-white tw-py-[3rem] tw-px-[7rem] tw-shadow-lg tw-rounded-lg">
            <div className="tw-mt-3 tw-text-lg tw-text-center tw-text-neutral-700">
                {inviteStringSegments[0]}
                {
                    <Link
                        href={shortLink}
                        target="_blank"
                        className="tw-text-primary-color tw-font-bold hover:tw-text-orange-300"
                    >
                        {shortLink}
                    </Link>
                }
                {inviteStringSegments[1]}
            </div>
            <div className="tw-text-4xl tw-mt-4 tw-flex tw-flex-row tw-items-center">
                {displayJoinCode}
                <div className="tw-ml-2 tw-text-[75%]">
                    <CopyButton
                        copyValue={joinDeepLink}
                        title={lf("Copy join link")}
                        eventName="mp.hostlobby.copyjoinlink"
                    />
                </div>
            </div>
            <Button
                className={"primary tw-mt-5 tw-mb-7 tw-font-sans"}
                label={lf("Start Game")}
                title={lf("Start Game")}
                onClick={onStartGameClick}
            />
            <PresenceBar />
        </div>
    );
}
