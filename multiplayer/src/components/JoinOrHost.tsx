import { useCallback, useContext, useEffect, useRef, useState } from "react";

import { dispatch } from "../state";
import { setTargetConfig } from "../state/actions";
import { AppStateContext } from "../state/AppStateContext";
import { Button } from "../../../react-common/components/controls/Button";
import { Input } from "react-common/components/controls/Input";
import { Link } from "react-common/components/controls/Link";
import { hostGameAsync, joinGameAsync } from "../epics";
import TabButton from "./TabButton";
import HostGameButton from "./HostGameButton";
import BetaTag from "./BetaTag";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { targetConfig } = state;
    const [currTab, setCurrTab] = useState<"join" | "host">("join");
    const joinCodeRef = useRef<HTMLInputElement>();
    const shareCodeRef = useRef<HTMLInputElement>();

    useEffect(() => {
        if (!targetConfig) {
            // targetConfigAsync ends up at localhost:3000 and cors issues hitting 3232
            const req = pxt.BrowserUtils.isLocalHostDev()
                ? fetch(`/blb/targetconfig.json`, {
                      method: "GET",
                  }).then(resp => resp.json() as pxt.TargetConfig | undefined)
                : pxt.targetConfigAsync();
            req.then(trgcfg => trgcfg && dispatch(setTargetConfig(trgcfg)));
        }
    });

    const setJoinCodeRef = useCallback((ref: HTMLInputElement) => {
        joinCodeRef.current = ref;
    }, []);
    const setShareCodeRef = useCallback((ref: HTMLInputElement) => {
        shareCodeRef.current = ref;
    }, []);

    const onJoinGameClick = async () => {
        if (joinCodeRef?.current?.value) {
            await joinGameAsync(joinCodeRef.current.value);
        }
    };
    const onHostGameClick = async () => {
        if (shareCodeRef?.current?.value) {
            await hostGameAsync(shareCodeRef.current.value);
        }
    };

    const enterShareOrLink = lf("Enter share code or link");
    const howToGetLink = lf("How do I get a share code or link?");
    const moreGamesToPlay = lf("More games to play with your friends");

    const starterGames = targetConfig?.multiplayer?.games;
    const showStarterGames = !!starterGames?.length && currTab === "host";

    return (
        <div className="tw-flex tw-flex-col tw-w-screen tw-h-screen tw-justify-center tw-items-center">
            <div className="tw-bg-white tw-rounded-lg tw-drop-shadow-xl tw-min-h-[17rem] tw-min-w-[17rem] md:tw-min-w-[25rem]">
                <div className="tw-absolute tw-translate-y-[-130%]">
                    <BetaTag />
                </div>
                <div className="tw-py-5 tw-px-10 ">
                    <div className="tw-pt-2">
                        <div className="tw-flex tw-justify-center">
                            <TabButton
                                title={lf("Join Game")}
                                label={
                                    <>
                                        <div className="tw-hidden sm:tw-inline">
                                            {lf("Join Game")}
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
                                title={lf("Host Game")}
                                label={
                                    <>
                                        <div className="tw-hidden sm:tw-inline">
                                            {lf("Host Game")}
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
                                            label={lf("Enter")}
                                            title={lf("Join Game")}
                                            onClick={onJoinGameClick}
                                        />
                                    </div>
                                    <div className="tw-text-sm">
                                        <Link
                                            href="/docs/multiplayer#join-game"
                                            target="_blank"
                                        >
                                            {lf("How do I get a game code?")}
                                        </Link>
                                    </div>
                                </div>
                            )}
                            {currTab === "host" && (
                                <div className="tw-w-full tw-flex tw-flex-col tw-gap-4 tw-mt-2 tw-justify-center tw-items-center">
                                    <div className="tw-w-full">
                                        <Input
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
                                            title={lf("Host Game")}
                                            onClick={onHostGameClick}
                                        />
                                    </div>
                                    <div className="tw-text-sm">
                                        <Link
                                            href="/docs/multiplayer#host-game"
                                            target="_blank"
                                        >
                                            {howToGetLink}
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {showStarterGames && (
                <div className="tw-max-w-[60em] tw-p-2">
                    <div className="tw-w-full tw-p-2">{moreGamesToPlay}</div>
                    <div className="tw-flex tw-justify-between tw-space-x-4">
                        {starterGames.map((game, i) => {
                            return (
                                <HostGameButton
                                    shareId={game.shareId}
                                    title={game.title}
                                    subtitle={game.subtitle}
                                    image={game.image}
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
