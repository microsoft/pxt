import { useContext } from "react";
import { AppStateContext } from "../state/AppStateContext";
import ArcadeSimulator from "./ArcadeSimulator";
import HostLobby from "./HostLobby";
import JoinCodeLabel from "./JoinCodeLabel";
import JoinLobby from "./JoinLobby";
import KeyboardControlsButton from "./KeyboardControlsButton";
import PresenceBar from "./PresenceBar";
import EditGameButton from "./EditGameButton";
import ToggleMuteButton from "./ToggleMuteButton";

export interface GamePageProps {}

export default function Render(props: GamePageProps) {
    const { state } = useContext(AppStateContext);
    const { netMode, clientRole } = state;

    return (
        <>
            {netMode === "connecting" && <></>}
            {state.gameState?.gameMode === "lobby" && (
                <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-w-full tw-h-full">
                    {clientRole === "host" && <HostLobby />}
                    {clientRole === "guest" && <JoinLobby />}
                </div>
            )}
            <div
                className="tw-flex tw-flex-col tw-items-center tw-grow tw-pb-4"
                style={state.gameState?.gameMode !== "playing" ? { display: "none" } : undefined}
            >
                <ArcadeSimulator />
                <div className="tw-flex tw-flex-row tw-w-full tw-items-center tw-justify-between tw-mt-1 tw-ml-1">
                    <div>
                        <ToggleMuteButton />
                        <div className="tw-hidden sm:tw-inline-block">
                            <EditGameButton />
                        </div>
                    </div>
                    <div className="tw-mr-1 sm:tw-mr-0">
                        <JoinCodeLabel />
                    </div>
                    <div className="tw-hidden sm:tw-inline">
                        <KeyboardControlsButton />
                    </div>
                    <div className="tw-inline-block sm:tw-hidden">
                        <EditGameButton />
                    </div>
                </div>
                <div className="tw-mt-3">
                    <PresenceBar />
                </div>
            </div>
        </>
    );
}
