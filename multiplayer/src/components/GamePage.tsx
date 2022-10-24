import { faVolumeHigh } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useContext } from "react";
import { Button } from "react-common/components/controls/Button";
import { leaveGameAsync } from "../epics";
import { AppStateContext, dispatch } from "../state/AppStateContext";
import ArcadeSimulator from "./ArcadeSimulator";
import Presence from "./Presence";
import Reactions from "./Reactions";

export interface GamePageProps {}

export default function Render(props: GamePageProps) {
    const { state } = useContext(AppStateContext);
    const { appMode } = state;
    const { netMode, uiMode } = appMode;

    const onLeaveGameClick = async () => {
        pxt.tickEvent("mp.leavegame");
        await leaveGameAsync();
    };

    const toggleMute = () => {};

    return (
        <div>
            {netMode === "connecting" && (
                <div className="tw-text-lg tw-font-bold tw-mt-5">
                    {lf("Connecting...")}
                </div>
            )}
            {state.gameState?.gameMode && (
                <div className="tw-flex tw-flex-col tw-items-center">
                    {state.playerSlot && <ArcadeSimulator />}
                    <div className="tw-flex tw-flex-row tw-space-x-2 tw-w-full tw-items-center">
                        {/* <sui.Button icon="volume up" onClick={() => {}}/> sui.Button has a volume up and volume down icon? Can we use that? What's sui? */}
                        <button
                            title={lf("Toggle Mute")}
                            className="tw-border-2 tw-border-slate-400 tw-rounded-md tw-px-2 tw-py-1 tw-bg-slate-100 hover:tw-bg-slate-200 active:tw-bg-slate-300"
                            onClick={toggleMute}
                        >
                            <FontAwesomeIcon icon={faVolumeHigh} />
                        </button>
                        <div>
                            {state.gameState?.joinCode &&
                                `${lf("Join Code")}: ${
                                    state.gameState?.joinCode
                                }`}
                        </div>
                        <div className="tw-flex-grow" />
                        <div>{lf("Keyboard Controls")}</div>
                    </div>
                    <div className="tw-flex tw-flex-row tw-space-x-2 tw-items-center tw-align-middle tw-justify-center tw-mt-3">
                        <Reactions />
                        <Presence />
                    </div>
                    <div>
                        <Button
                            className={"gray tw-mt-5"}
                            label={lf("Leave Game")}
                            title={lf("Leave Game")}
                            onClick={onLeaveGameClick}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
