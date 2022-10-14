import { useContext } from "react";
import { Button } from "react-common/components/controls/Button";
import { leaveGameAsync } from "../epics";
import { AppStateContext, dispatch } from "../state/AppStateContext";
import ArcadeSimulator from "./ArcadeSimulator";
import Presence from "./Presence";
import Reactions from "./Reactions";

export interface GamePageProps {
}

export default function Render(props: GamePageProps) {
    const { state } = useContext(AppStateContext);
    const { appMode } = state;
    const { netMode, uiMode } = appMode;

    const onLeaveGameClick = async () => {
        pxt.tickEvent("mp.leavegame");
        await leaveGameAsync();
    };

    return (
        <div>
            {netMode === "connecting" && (
                <div className="tw-text-lg tw-font-bold tw-mt-5">
                    {lf("Connecting...")}
                </div>
            )}
            {/*
            If we make the lobby non-modal, it would make sense to put it here.
            state.gameState?.gameMode === "lobby" && dispatch(showModal(uiMode === "host" ? "host-lobby" : "join-lobby"))
            */}
            {state.gameState?.gameMode && (
                <div className="tw-flex tw-flex-col tw-items-center">
                    <ArcadeSimulator />
                    <div className="tw-flex tw-flex-row tw-space-x-2 tw-w-full">
                        <div>{state.gameState?.joinCode && `Join Code: ${state.gameState?.joinCode}`}</div>
                        <div className="tw-flex-grow"/>
                        <div>Keyboard Controls</div>
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
