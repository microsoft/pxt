import { useContext } from "react";
import { Button } from "react-common/components/controls/Button";
import { leaveGameAsync } from "../epics";
import { AppStateContext, dispatch } from "../state/AppStateContext";
import ArcadeSimulator from "./ArcadeSimulator";
import JoinLobby from "./JoinLobbyModal";
import HostLobby from "./HostLobbyModal";
import Presence from "./Presence";
import Reactions from "./Reactions";
import { showModal } from "../state/actions";

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

    const showLobbyModal = () => {
        const modalType = uiMode === "host" ? "host-lobby" : "join-lobby";
        dispatch(showModal(modalType));
    }

    if(state.gameState?.gameMode === "lobby") {
        //showLobbyModal();
    }

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
                    <div className="tw-mt-5">
                        <Presence />
                    </div>
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
