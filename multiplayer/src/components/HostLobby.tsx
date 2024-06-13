import { useContext } from "react";
import { Button } from "react-common/components/controls/Button";
import { Link } from "react-common/components/controls/Link";
import { startGameAsync } from "../epics";
import { clearModal } from "../state/actions";
import { AppStateContext } from "../state/AppStateContext";
import { QRCodeSVG } from "qrcode.react";
import CopyButton from "./CopyButton";
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
    const inviteString = lf("Have your friend go to {0} and enter code", "{0}");
    const inviteStringSegments = inviteString.split("{0}");
    const shortLink = pxt.multiplayer.SHORT_LINK();

    // Insert a space to make the join code easier to read.
    const displayJoinCode = joinCode?.slice(0, 3) + " " + joinCode?.slice(3);
    const joinDeepLink = pxt.multiplayer.makeJoinLink(joinCode, true);

    return (
        <div className="tw-bg-white tw-shadow-lg tw-rounded-lg tw-m-1 tw-min-w-[17rem]">
            <div className="tw-flex tw-flex-col tw-gap-1 tw-items-center tw-justify-between tw-py-[3rem] tw-px-3 sm:tw-px-14 md:tw-px-[7rem]">
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
                <div className="tw-text-4xl tw-mt-4 tw-flex tw-flex-row tw-items-center tw-ml-2">
                    <CopyButton
                        copyValue={joinDeepLink}
                        title={lf("Copy join link")}
                        eventName="mp.hostlobby.copyjoinlink"
                        label={
                            <span className="tw-font-bold tw-text-neutral-700 tw-mr-1 tw-whitespace-nowrap">
                                {displayJoinCode}
                            </span>
                        }
                        toastMessage={lf("Join link copied")}
                    />
                </div>
                <div className="tw-flex tw-flex-col tw-items-center tw-mt-5 tw-text-sm tw-gap-1 tw-max-h-24 md:tw-max-h-36">
                    <QRCodeSVG value={joinDeepLink} />
                    <div className="tw-hidden md:tw-block">{lf("or scan with phone")}</div>
                </div>
                <Button
                    className={"primary tw-mt-5 tw-font-sans tw-mr-0"}
                    label={lf("Start Game")}
                    title={lf("Start Game")}
                    onClick={onStartGameClick}
                />
                <Link href="/multiplayer#safety" target="_blank" className="tw-text-sm tw-mt-1 tw-mb-7">
                    {lf("Multiplayer Online Safety")}
                </Link>
                <PresenceBar />
            </div>
        </div>
    );
}
