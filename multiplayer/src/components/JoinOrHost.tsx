import { useCallback, useContext, useEffect, useRef, useState } from "react";

import { dispatch } from "../state";
import { setTargetConfig } from "../state/actions";
import { AppStateContext } from "../state/AppStateContext";
import { Button } from "../../../react-common/components/controls/Button";
import { Input } from "react-common/components/controls/Input";
import { Link } from "react-common/components/controls/Link";
import { hostCollabAsync, joinCollabAsync } from "../epics";
import { resourceUrl } from "../util";
import TabButton from "./TabButton";
import HostGameButton from "./HostGameButton";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { targetConfig } = state;
    const [currTab, setCurrTab] = useState<"join" | "host">("join");
    const joinCodeRef = useRef<HTMLInputElement>();
    const shareCodeRef = useRef<HTMLInputElement>();

    const setJoinCodeRef = useCallback((ref: HTMLInputElement) => {
        joinCodeRef.current = ref;
    }, []);
    const setShareCodeRef = useCallback((ref: HTMLInputElement) => {
        shareCodeRef.current = ref;
    }, []);

    const onJoinGameClick = async () => {
        if (joinCodeRef?.current?.value) {
            await joinCollabAsync(joinCodeRef.current.value);
        }
    };
    const onHostGameClick = async () => {
        await hostCollabAsync();
    };

    const enterShareOrLink = lf("Enter share code or link");
    const howToGetLink = lf("How do I get a share code or link?");
    const moreGamesToPlay = lf("More games to play with your friends");

    const starterGames = targetConfig?.multiplayer?.games ?? [];
    const showStarterGames = false;

    return (
        <div className="tw-flex tw-flex-col tw-w-screen tw-h-screen tw-justify-center tw-items-center">
            <div className="tw-bg-white tw-rounded-lg tw-drop-shadow-xl tw-min-h-[17rem] tw-min-w-[17rem] md:tw-min-w-[25rem]">
                <div className="tw-py-5 tw-px-10 ">
                    <div className="tw-pt-2">
                        <div className="tw-flex tw-justify-center">
                            <TabButton
                                title={lf("Join Collab")}
                                label={
                                    <>
                                        <div className="tw-hidden sm:tw-inline">
                                            {lf("Join Collab")}
                                        </div>
                                        <div className="sm:tw-hidden">
                                            {lf("Join")}
                                        </div>
                                    </>
                                }
                                selected={currTab === "join"}
                                onClick={() => setCurrTab("join")}
                            />
                            <TabButton
                                title={lf("Host Collab")}
                                label={
                                    <>
                                        <div className="tw-hidden sm:tw-inline">
                                            {lf("Host Collab")}
                                        </div>
                                        <div className="sm:tw-hidden">
                                            {lf("Host")}
                                        </div>
                                    </>
                                }
                                selected={currTab === "host"}
                                onClick={() => setCurrTab("host")}
                            />
                        </div>
                        <div className="tw-pt-2">
                            {currTab === "join" && (
                                <div className="tw-w-full tw-flex tw-flex-col tw-gap-4 tw-mt-2 tw-justify-center tw-items-center">
                                    <div className="tw-w-full">
                                        <Input
                                            groupClassName="tw-w-full tw-border-1 tw-h-full tw-rounded"
                                            inputClassName="tw-text-center tw-p-2"
                                            title={lf("Join Code")}
                                            autoComplete={false}
                                            handleInputRef={setJoinCodeRef}
                                            preserveValueOnBlur={true}
                                            onEnterKey={onJoinGameClick}
                                            placeholder={lf("Enter game code")}
                                        />
                                    </div>
                                    <div>
                                        <Button
                                            className={"primary tw-px-10"}
                                            label={lf("Join")}
                                            title={lf("Join Collab")}
                                            onClick={onJoinGameClick}
                                        />
                                    </div>
                                    <div className="tw-text-sm">
                                        <Link
                                            href="/multiplayer#join-game"
                                            target="_blank"
                                        >
                                            {lf("How do I get a collab code?")}
                                        </Link>
                                    </div>
                                </div>
                            )}
                            {currTab === "host" && (
                                <div className="tw-w-full tw-flex tw-flex-col tw-gap-4 tw-mt-2 tw-justify-center tw-items-center">
                                    <div className="tw-w-full">
                                        <Input
                                            className="tw-invisible"
                                            groupClassName="tw-w-full tw-border-1 tw-h-full tw-rounded"
                                            inputClassName="tw-p-2"
                                            title={lf("Share Code")}
                                            autoComplete={false}
                                            handleInputRef={setShareCodeRef}
                                            preserveValueOnBlur={true}
                                            onEnterKey={onHostGameClick}
                                            placeholder={enterShareOrLink}
                                        />
                                    </div>
                                    <div>
                                        <Button
                                            className={"primary tw-px-10"}
                                            label={lf("Launch")}
                                            title={lf("Host Collab")}
                                            onClick={onHostGameClick}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {showStarterGames && (
                <div className="tw-max-w-[min(90vw,60em)] tw-p-2 tw-flex tw-flex-col tw-shrink">
                    <div className="tw-w-full tw-p-2">{moreGamesToPlay}</div>
                    <div className="tw-flex tw-justify-between tw-space-x-1 md:tw-space-x-4">
                        {starterGames.map((game, i) => {
                            return (
                                <HostGameButton
                                    shareId={game.shareId}
                                    title={pxt.Util.rlf(
                                        `{id:game-title}${game.title}`
                                    )}
                                    subtitle={pxt.Util.rlf(
                                        `{id:game-subtitle}${game.subtitle}`
                                    )}
                                    image={resourceUrl(game.image)}
                                    key={i}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
