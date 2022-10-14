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
                <>
                    <ArcadeSimulator />
                    <Presence />
                    <div className="tw-mt-5">
                        <Reactions />
                    </div>
                    <div className="tw-mt-1">
                        <Button
                            className={"gray"}
                            label={lf("Leave Game")}
                            title={lf("Leave Game")}
                            onClick={onLeaveGameClick}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
